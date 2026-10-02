import { Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { config } from '../common/config.js';

type PexelsVideo = {
  id: number;
  url: string;
  image: string;
  user: { name: string; url: string };
  video_files: {
    link: string;
    file_type: string;
    width: number;
    height: number;
  }[];
};

@Injectable()
export class PexelsService {
  private expiresAt = 0;
  private pending?: Promise<void>;
  private readonly logger = new Logger(PexelsService.name);
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async refresh() {
    if (!config.pexelsKey || this.expiresAt > Date.now()) return;
    this.pending ??= this.fetchPage().finally(() => {
      this.pending = undefined;
    });
    await this.pending;
  }

  private async fetchPage() {
    try {
      const response = await fetch(
        'https://api.pexels.com/videos/popular?per_page=40&min_duration=3&max_duration=45',
        {
          headers: { Authorization: config.pexelsKey! },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw new Error(`Pexels returned ${response.status}`);
      const payload = (await response.json()) as { videos: PexelsVideo[] };
      for (const video of payload.videos) {
        const files = video.video_files.filter(
          (file) =>
            file.file_type === 'video/mp4' &&
            file.height >= 360 &&
            file.height <= 1280,
        );
        const file = files.sort(
          (a, b) => Math.abs(a.height - 720) - Math.abs(b.height - 720),
        )[0];
        if (!file || !file.link.startsWith('https://')) continue;
        const data = {
          creatorName: video.user.name,
          attributionUrl: video.url,
          playbackUrl: file.link,
          thumbnailUrl: video.image,
          caption: `Video by ${video.user.name} on Pexels`,
        };
        await this.db.video.upsert({
          where: {
            source_sourceId: { source: 'PEXELS', sourceId: String(video.id) },
          },
          update: data,
          create: { source: 'PEXELS', sourceId: String(video.id), ...data },
        });
      }
      this.expiresAt = Date.now() + 15 * 60 * 1000;
    } catch (error) {
      this.expiresAt = Date.now() + 60 * 1000;
      this.logger.warn(
        `Could not refresh Pexels; using persisted feed: ${error instanceof Error ? error.message : 'network error'}`,
      );
    }
  }
}
