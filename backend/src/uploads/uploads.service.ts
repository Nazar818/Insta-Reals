import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseService } from '../database/database.service.js';
import { config, hasMux } from '../common/config.js';
import { record, text, uniqueError } from '../common/validation.js';
import { MuxService } from '../providers/mux.service.js';
import type { Upload } from '../generated/prisma/client.js';

const videoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function validVideoSignature(bytes: Buffer, contentType: string) {
  if (bytes.length < 12) return false;
  if (contentType === 'video/webm')
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return bytes.subarray(4, 8).toString('ascii') === 'ftyp';
}

@Injectable()
export class UploadsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MuxService) private readonly mux: MuxService,
  ) {}

  format(upload: Upload) {
    return {
      id: upload.id,
      uploadUrl: upload.status === 'pending' ? upload.uploadUrl : null,
      status: upload.status,
      provider: upload.provider,
      videoId: upload.videoId,
    };
  }

  async owner(viewerId: string, id: string) {
    const upload = await this.db.upload.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException('Upload not found');
    if (upload.ownerId !== viewerId)
      throw new ForbiddenException('This upload belongs to another account');
    return upload;
  }

  async get(viewerId: string, id: string) {
    return this.format(await this.owner(viewerId, id));
  }

  async create(viewerId: string, body: unknown) {
    const input = record(body);
    const caption = text(input.caption, 'caption', 500, 0);
    if (
      typeof input.contentType !== 'string' ||
      !videoTypes.includes(input.contentType)
    )
      throw new BadRequestException('Choose an MP4, MOV or WebM video');
    const provider = hasMux() ? 'mux' : config.demoMode ? 'local' : null;
    if (!provider)
      throw new ServiceUnavailableException('Mux uploads are not configured');
    const upload = await this.db.upload.create({
      data: {
        ownerId: viewerId,
        caption,
        contentType: input.contentType,
        provider,
      },
    });
    try {
      if (provider === 'mux') {
        const remote = await this.mux.createUpload(upload.id);
        return this.format(
          await this.db.upload.update({
            where: { id: upload.id },
            data: { providerId: remote.id, uploadUrl: remote.url },
          }),
        );
      }
      return this.format(
        await this.db.upload.update({
          where: { id: upload.id },
          data: {
            uploadUrl: `${config.publicUrl}/v1/uploads/${upload.id}/content`,
          },
        }),
      );
    } catch (error) {
      await this.db.upload.update({
        where: { id: upload.id },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  async content(
    viewerId: string,
    id: string,
    body: unknown,
    contentType?: string,
  ) {
    const upload = await this.owner(viewerId, id);
    if (!config.demoMode || upload.provider !== 'local')
      throw new ForbiddenException(
        'Local uploads are available only in demo mode',
      );
    if (upload.status !== 'pending')
      throw new ConflictException('This upload has already been submitted');
    if (
      !Buffer.isBuffer(body) ||
      body.length === 0 ||
      body.length > MAX_UPLOAD_BYTES
    )
      throw new BadRequestException('Upload a video up to 100 MB');
    const mime = contentType?.split(';')[0].trim();
    if (mime !== upload.contentType || !validVideoSignature(body, mime))
      throw new BadRequestException(
        'Video content does not match its declared type',
      );
    const claimed = await this.db.upload.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'processing' },
    });
    if (!claimed.count)
      throw new ConflictException('This upload is being processed');
    const extension =
      mime === 'video/webm'
        ? 'webm'
        : mime === 'video/quicktime'
          ? 'mov'
          : 'mp4';
    const filename = `${id}.${extension}`;
    const directory = join(config.dataDir, 'videos');
    const path = join(directory, filename);
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(path, body, { flag: 'wx' });
      const owner = await this.db.user.findUniqueOrThrow({
        where: { id: viewerId },
      });
      const ready = await this.db.$transaction(async (tx) => {
        const video = await tx.video.create({
          data: {
            source: 'LOCAL',
            sourceId: id,
            ownerId: viewerId,
            creatorName: owner.displayName,
            caption: upload.caption,
            playbackUrl: `${config.publicUrl}/v1/media/${filename}`,
          },
        });
        return tx.upload.update({
          where: { id },
          data: { status: 'ready', videoId: video.id, uploadUrl: null },
        });
      });
      return this.format(ready);
    } catch (error) {
      await this.db.upload.update({
        where: { id },
        data: { status: 'failed' },
      });
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }

  async webhook(raw: Buffer, signature?: string) {
    const event = record(this.mux.verifyWebhook(raw, signature));
    const eventId = text(event.id, 'event id', 150);
    const type = text(event.type, 'event type', 150);
    const data = record(event.data);
    if (await this.db.webhookEvent.findUnique({ where: { id: eventId } }))
      return { ok: true };
    try {
      await this.db.$transaction(async (tx) => {
        await tx.webhookEvent.create({ data: { id: eventId } });
        const upload = await tx.upload.findFirst({
          where: {
            provider: 'mux',
            OR: [
              ...(typeof data.upload_id === 'string'
                ? [{ providerId: data.upload_id }]
                : []),
              ...(typeof data.passthrough === 'string'
                ? [{ id: data.passthrough }]
                : []),
              ...(type.startsWith('video.upload.') &&
              typeof data.id === 'string'
                ? [{ providerId: data.id }]
                : []),
              ...(type.startsWith('video.asset.') && typeof data.id === 'string'
                ? [{ assetId: data.id }]
                : []),
            ],
          },
        });
        if (!upload) return;
        if (
          type === 'video.upload.asset_created' &&
          upload.status !== 'ready'
        ) {
          await tx.upload.update({
            where: { id: upload.id },
            data: {
              assetId: typeof data.asset_id === 'string' ? data.asset_id : null,
              status: 'processing',
              uploadUrl: null,
            },
          });
        } else if (type === 'video.asset.ready') {
          const ids = Array.isArray(data.playback_ids)
            ? (data.playback_ids as { id?: string; policy?: string }[])
            : [];
          const playback = ids.find((entry) => entry.policy === 'public')?.id;
          if (!playback || typeof data.id !== 'string')
            throw new BadRequestException(
              'Mux asset is missing public playback',
            );
          const owner = await tx.user.findUniqueOrThrow({
            where: { id: upload.ownerId },
          });
          const video = await tx.video.upsert({
            where: { source_sourceId: { source: 'MUX', sourceId: data.id } },
            update: { ready: true },
            create: {
              source: 'MUX',
              sourceId: data.id,
              ownerId: upload.ownerId,
              creatorName: owner.displayName,
              caption: upload.caption,
              playbackUrl: `https://stream.mux.com/${playback}.m3u8`,
              thumbnailUrl: `https://image.mux.com/${playback}/thumbnail.jpg`,
            },
          });
          await tx.upload.update({
            where: { id: upload.id },
            data: {
              status: 'ready',
              videoId: video.id,
              assetId: data.id,
              uploadUrl: null,
            },
          });
        } else if (
          [
            'video.asset.errored',
            'video.upload.errored',
            'video.upload.cancelled',
            'video.upload.timed_out',
          ].includes(type) &&
          upload.status !== 'ready'
        ) {
          await tx.upload.update({
            where: { id: upload.id },
            data: { status: 'failed', uploadUrl: null },
          });
        }
      });
    } catch (error) {
      if (!uniqueError(error)) throw error;
    }
    return { ok: true };
  }
}
