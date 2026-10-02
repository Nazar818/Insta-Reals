import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { rowsPage, record, text, uniqueError } from '../common/validation.js';

const userInclude = {
  _count: { select: { followers: true, following: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async identity(subject: string, name?: string, avatarUrl?: string) {
    const demo = subject.startsWith('demo:');
    const account = subject.slice(5);
    const username = demo
      ? account
      : `member_${createHash('sha256').update(subject).digest('hex').slice(0, 12)}`;
    return this.db.user.upsert({
      where: { clerkId: subject },
      update: {},
      create: {
        clerkId: subject,
        username,
        displayName: demo
          ? account === 'alex'
            ? 'Alex Rivera'
            : 'Sam Chen'
          : name?.slice(0, 60) || 'New member',
        avatarUrl: avatarUrl ?? null,
        bio: demo ? 'Trying out Reals. Say hello!' : '',
      },
    });
  }

  async get(id: string, viewerId: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      include: userInclude,
    });
    if (!user) throw new NotFoundException('User not found');
    const follow = await this.db.follow.findUnique({
      where: {
        followerId_followedId: { followerId: viewerId, followedId: id },
      },
    });
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      viewerIsFollowing: Boolean(follow),
    };
  }

  async patch(viewerId: string, body: unknown) {
    const input = record(body);
    const allowed = ['username', 'displayName', 'bio'];
    if (Object.keys(input).some((key) => !allowed.includes(key)))
      throw new BadRequestException('Unknown profile field');
    const data: { username?: string; displayName?: string; bio?: string } = {};
    if (input.username !== undefined) {
      data.username = text(input.username, 'username', 30, 3);
      if (!/^[a-z0-9_]+$/.test(data.username))
        throw new BadRequestException(
          'Username must contain lowercase letters, numbers and underscores',
        );
    }
    if (input.displayName !== undefined)
      data.displayName = text(input.displayName, 'displayName', 60);
    if (input.bio !== undefined) data.bio = text(input.bio, 'bio', 160, 0);
    try {
      await this.db.user.update({ where: { id: viewerId }, data });
    } catch (error) {
      if (uniqueError(error))
        throw new ConflictException('That username is already taken');
      throw error;
    }
    return this.get(viewerId, viewerId);
  }

  async search(viewerId: string, query?: string, cursor?: string) {
    if (query && query.length > 100)
      throw new BadRequestException('Search is too long');
    const where = {
      id: { not: viewerId },
      ...(query
        ? {
            OR: [
              { username: { contains: query, mode: 'insensitive' as const } },
              {
                displayName: {
                  contains: query,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    if (
      cursor &&
      !(await this.db.user.findFirst({ where: { ...where, id: cursor } }))
    )
      throw new BadRequestException('Invalid cursor');
    const users = await this.db.user.findMany({
      where,
      orderBy: { username: 'asc' },
      take: 31,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rowsPage(users, 30);
    return {
      ...page,
      items: await Promise.all(
        page.items.map((user) => this.get(user.id, viewerId)),
      ),
    };
  }

  async follow(viewerId: string, id: string, following: boolean) {
    if (viewerId === id)
      throw new BadRequestException('You cannot follow yourself');
    await this.get(id, viewerId);
    if (following)
      await this.db.follow.upsert({
        where: {
          followerId_followedId: { followerId: viewerId, followedId: id },
        },
        create: { followerId: viewerId, followedId: id },
        update: {},
      });
    else
      await this.db.follow.deleteMany({
        where: { followerId: viewerId, followedId: id },
      });
    return this.get(id, viewerId);
  }
}
