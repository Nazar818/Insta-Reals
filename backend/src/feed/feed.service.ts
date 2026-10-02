import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { config } from '../common/config.js';
import { rowsPage, record } from '../common/validation.js';
import { PexelsService } from '../providers/pexels.service.js';
import { UsersService } from '../users/users.service.js';
import { Prisma } from '../generated/prisma/client.js';

const include = {
  owner: true,
  _count: { select: { likes: true, comments: true } },
  likes: { select: { userId: true } },
} as const;
type VideoRecord = Prisma.VideoGetPayload<{ include: typeof include }>;

@Injectable()
export class FeedService implements OnModuleInit {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(PexelsService) private readonly pexels: PexelsService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async onModuleInit() {
    if (!config.demoMode) return;
    await Promise.all([
      this.users.identity('demo:alex'),
      this.users.identity('demo:sam'),
    ]);
    if (config.pexelsKey) return;
    const samples = [
      {
        sourceId: 'big-buck-bunny',
        creatorName: 'Blender Foundation',
        attributionUrl: 'https://peach.blender.org/',
        playbackUrl:
          'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4',
        thumbnailUrl:
          'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_328.thumbs/BigBuckBunny_000030.jpg',
        caption: 'Big Buck Bunny · Blender Foundation · CC BY 3.0',
      },
      {
        sourceId: 'elephants-dream',
        creatorName: 'Blender Foundation',
        attributionUrl: 'https://orange.blender.org/',
        playbackUrl:
          'https://archive.org/download/ElephantsDream/ed_1024.mp4',
        thumbnailUrl:
          'https://archive.org/download/ElephantsDream/ElephantsDream.thumbs/ed_1024_000030.jpg',
        caption: 'Elephants Dream · Blender Foundation · CC BY 2.5',
      },
      {
        sourceId: 'tears-of-steel',
        creatorName: 'Blender Foundation',
        attributionUrl: 'https://mango.blender.org/',
        playbackUrl:
          'https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4',
        thumbnailUrl:
          'https://archive.org/download/Tears-of-Steel/tos-poster.jpg',
        caption: 'Tears of Steel · Blender Foundation · CC BY 3.0',
      },
    ];
    for (const sample of samples)
      await this.db.video.upsert({
        where: {
          source_sourceId: { source: 'SAMPLE', sourceId: sample.sourceId },
        },
        update: sample,
        create: { source: 'SAMPLE', ...sample },
      });
  }

  format(video: VideoRecord, viewerId: string) {
    return {
      id: video.id,
      source: video.source.toLowerCase(),
      playbackUrl: video.playbackUrl,
      thumbnailUrl: video.thumbnailUrl,
      caption: video.caption,
      creator: {
        displayName: video.owner?.displayName ?? video.creatorName,
        appUserId: video.ownerId,
        attributionUrl: video.attributionUrl,
      },
      likeCount: video._count.likes,
      commentCount: video._count.comments,
      viewerHasLiked: video.likes.some((like) => like.userId === viewerId),
    };
  }

  async get(id: string, viewerId: string) {
    const video = await this.db.video.findUnique({
      where: { id, ready: true },
      include,
    });
    if (!video) throw new NotFoundException('Video not found');
    return this.format(video, viewerId);
  }

  async list(
    viewerId: string,
    mode = 'discover',
    cursor?: string,
    ownerId?: string,
  ) {
    if (!['discover', 'following', 'recommended'].includes(mode))
      throw new BadRequestException('Invalid feed mode');
    if (mode === 'recommended' && cursor)
      return this.rankedPage(viewerId, cursor);
    await this.pexels.refresh();
    const follows = await this.db.follow.findMany({
      where: { followerId: viewerId },
      select: { followedId: true },
    });
    const followedIds = follows.map((follow) => follow.followedId);
    if (ownerId) await this.users.get(ownerId, viewerId);
    const where = {
      ready: true,
      ...(ownerId
        ? { ownerId }
        : mode === 'following'
          ? { ownerId: { in: followedIds } }
          : {}),
    };
    if (
      mode !== 'recommended' &&
      cursor &&
      !(await this.db.video.findFirst({ where: { ...where, id: cursor } }))
    )
      throw new BadRequestException('Invalid cursor');
    const videos = await this.db.video.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: mode === 'recommended' ? 1000 : 13,
      ...(mode !== 'recommended' && cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
    });
    if (mode === 'recommended') {
      const [likes, views] = await Promise.all([
        this.db.like.findMany({
          where: { userId: viewerId },
          include: { video: { select: { ownerId: true } } },
        }),
        this.db.videoView.findMany({
          where: { userId: viewerId },
          select: { videoId: true },
          distinct: ['videoId'],
        }),
      ]);
      const likedCreators = new Set(
        likes.map((like) => like.video.ownerId).filter(Boolean),
      );
      const watched = new Set(views.map((view) => view.videoId));
      const score = (video: VideoRecord) =>
        (video.ownerId && followedIds.includes(video.ownerId) ? 30 : 0) +
        (video.ownerId && likedCreators.has(video.ownerId) ? 15 : 0) +
        Math.min(video._count.likes, 20) * 2 +
        (watched.has(video.id) ? 0 : 10);
      videos.sort(
        (a, b) =>
          score(b) - score(a) ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      );
    }
    const page = rowsPage(videos, 12);
    if (mode === 'recommended' && page.nextCursor) {
      await this.db.feedSnapshot.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      const snapshot = await this.db.feedSnapshot.create({
        data: {
          userId: viewerId,
          videoIds: videos.map((video) => video.id),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      page.nextCursor = `rank:${snapshot.id}:12`;
    }
    return {
      ...page,
      items: page.items.map((video) => this.format(video, viewerId)),
    };
  }

  private async rankedPage(viewerId: string, cursor: string) {
    const match = /^rank:([a-z0-9]+):(\d+)$/.exec(cursor);
    if (!match) throw new BadRequestException('Invalid recommendation cursor');
    const offset = Number(match[2]);
    const snapshot = await this.db.feedSnapshot.findFirst({
      where: { id: match[1], userId: viewerId, expiresAt: { gt: new Date() } },
    });
    if (
      !snapshot ||
      !Number.isSafeInteger(offset) ||
      offset < 12 ||
      offset % 12 !== 0 ||
      offset >= snapshot.videoIds.length
    )
      throw new BadRequestException('Feed session expired; refresh the feed');
    const ids = snapshot.videoIds.slice(offset, offset + 12);
    const videos = await this.db.video.findMany({
      where: { ready: true, id: { in: ids } },
      include,
    });
    return {
      items: ids
        .map((id) => videos.find((video) => video.id === id))
        .filter((video): video is VideoRecord => Boolean(video))
        .map((video) => this.format(video, viewerId)),
      nextCursor:
        offset + 12 < snapshot.videoIds.length
          ? `rank:${snapshot.id}:${offset + 12}`
          : null,
    };
  }

  async view(viewerId: string, id: string, body: unknown) {
    const input = record(body);
    if (
      typeof input.watchDurationMs !== 'number' ||
      !Number.isInteger(input.watchDurationMs) ||
      input.watchDurationMs < 0 ||
      input.watchDurationMs > 24 * 60 * 60 * 1000 ||
      typeof input.completed !== 'boolean'
    )
      throw new BadRequestException(
        'Provide a valid watchDurationMs and completed flag',
      );
    await this.get(id, viewerId);
    if (
      input.watchDurationMs < 2000 &&
      !(input.completed && input.watchDurationMs >= 500)
    )
      return { ok: true };
    const recent = await this.db.videoView.findFirst({
      where: {
        userId: viewerId,
        videoId: id,
        viewedAt: { gte: new Date(Date.now() - 30000) },
      },
    });
    if (!recent)
      await this.db.videoView.create({
        data: {
          userId: viewerId,
          videoId: id,
          watchDurationMs: input.watchDurationMs,
          completed: input.completed,
        },
      });
    return { ok: true };
  }

  async history(viewerId: string, cursor?: string) {
    const anchor = cursor
      ? await this.db.videoView.aggregate({
          where: { userId: viewerId, videoId: cursor },
          _max: { viewedAt: true },
        })
      : null;
    if (cursor && !anchor?._max.viewedAt)
      throw new BadRequestException('Invalid cursor');
    const boundary =
      cursor && anchor?._max.viewedAt
        ? Prisma.sql`WHERE (h."viewedAt", h."videoId") < (${anchor._max.viewedAt}, ${cursor})`
        : Prisma.empty;
    const history = await this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
      WITH h AS (
        SELECT vv."videoId", MAX(vv."viewedAt") AS "viewedAt"
        FROM "VideoView" vv JOIN "Video" v ON v.id = vv."videoId"
        WHERE vv."userId" = ${viewerId} AND v.ready = true
        GROUP BY vv."videoId"
      )
      SELECT h."videoId" AS id FROM h ${boundary}
      ORDER BY h."viewedAt" DESC, h."videoId" DESC LIMIT 13
    `);
    const page = rowsPage(history, 12);
    const records = await this.db.video.findMany({
      where: { id: { in: page.items.map((item) => item.id) } },
      include,
    });
    return {
      ...page,
      items: page.items.map((item) =>
        this.format(
          records.find((video) => video.id === item.id)!,
          viewerId,
        ),
      ),
    };
  }
}
