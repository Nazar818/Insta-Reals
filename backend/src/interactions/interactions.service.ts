import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { rowsPage, record, text } from '../common/validation.js';
import { FeedService } from '../feed/feed.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class InteractionsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(FeedService) private readonly feed: FeedService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async like(viewerId: string, id: string, liked: boolean) {
    await this.feed.get(id, viewerId);
    if (liked)
      await this.db.like.upsert({
        where: { userId_videoId: { userId: viewerId, videoId: id } },
        create: { userId: viewerId, videoId: id },
        update: {},
      });
    else
      await this.db.like.deleteMany({
        where: { userId: viewerId, videoId: id },
      });
    return this.feed.get(id, viewerId);
  }

  async comments(viewerId: string, id: string, cursor?: string) {
    await this.feed.get(id, viewerId);
    if (
      cursor &&
      !(await this.db.comment.findFirst({ where: { id: cursor, videoId: id } }))
    )
      throw new BadRequestException('Invalid cursor');
    const comments = await this.db.comment.findMany({
      where: { videoId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 31,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rowsPage(comments, 30);
    return {
      ...page,
      items: await Promise.all(
        page.items.map(async (comment) => ({
          id: comment.id,
          text: comment.text,
          author: await this.users.get(comment.authorId, viewerId),
          createdAt: comment.createdAt.toISOString(),
        })),
      ),
    };
  }

  async comment(viewerId: string, id: string, body: unknown) {
    const input = record(body);
    const content = text(input.text, 'text', 2000);
    await this.feed.get(id, viewerId);
    const comment = await this.db.comment.create({
      data: { videoId: id, authorId: viewerId, text: content },
    });
    return {
      id: comment.id,
      text: comment.text,
      author: await this.users.get(viewerId, viewerId),
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
