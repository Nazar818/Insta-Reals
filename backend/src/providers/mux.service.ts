import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../common/config.js';

@Injectable()
export class MuxService {
  async createUpload(id: string) {
    const response = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.muxTokenId}:${config.muxTokenSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cors_origin: '*',
        new_asset_settings: {
          playback_policies: ['public'],
          passthrough: id,
          video_quality: 'basic',
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new BadGatewayException(
        'Mux could not create an upload. Check backend credentials.',
      );
    const payload = (await response.json()) as {
      data: { id: string; url: string };
    };
    if (!payload.data?.id || !payload.data.url?.startsWith('https://'))
      throw new BadGatewayException('Invalid Mux upload response');
    return payload.data;
  }

  verifyWebhook(raw: Buffer, header?: string) {
    if (!config.muxWebhookSecret)
      throw new UnauthorizedException('Mux webhook is not configured');
    const parts = (header ?? '')
      .split(',')
      .map((part) => part.trim().split('='));
    const timestamp = parts.find(([key]) => key === 't')?.[1];
    const signatures = parts
      .filter(([key]) => key === 'v1')
      .map(([, value]) => value);
    if (
      !timestamp ||
      !/^\d+$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
    )
      throw new UnauthorizedException('Expired webhook signature');
    const expected = createHmac('sha256', config.muxWebhookSecret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest();
    if (
      !signatures.some((signature) => {
        const given = Buffer.from(signature ?? '', 'hex');
        return (
          given.length === expected.length && timingSafeEqual(expected, given)
        );
      })
    )
      throw new UnauthorizedException('Invalid webhook signature');
    try {
      return JSON.parse(raw.toString()) as unknown;
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }
  }
}
