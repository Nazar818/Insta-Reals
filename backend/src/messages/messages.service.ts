import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { rowsPage, record, text } from '../common/validation.js';
import { UsersService } from '../users/users.service.js';
import type { Message } from '../generated/prisma/client.js';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  private message(message: Message) {
    return {
      id: message.id,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async member(viewerId: string, id: string) {
    const conversation = await this.db.conversation.findUnique({
      where: { id },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (
      conversation.participantAId !== viewerId &&
      conversation.participantBId !== viewerId
    )
      throw new ForbiddenException('This conversation is private');
    return conversation;
  }

  async get(viewerId: string, id: string) {
    const conversation = await this.member(viewerId, id);
    const message = await this.db.message.findFirst({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      id,
      otherUser: await this.users.get(
        conversation.participantAId === viewerId
          ? conversation.participantBId
          : conversation.participantAId,
        viewerId,
      ),
      lastMessage: message ? this.message(message) : null,
    };
  }

  async list(viewerId: string, cursor?: string) {
    if (cursor) await this.member(viewerId, cursor);
    const conversations = await this.db.conversation.findMany({
      where: {
        OR: [{ participantAId: viewerId }, { participantBId: viewerId }],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 31,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rowsPage(conversations, 30);
    return {
      ...page,
      items: await Promise.all(
        page.items.map((conversation) => this.get(viewerId, conversation.id)),
      ),
    };
  }

  async create(viewerId: string, body: unknown) {
    const input = record(body);
    const userId = text(input.userId, 'userId', 100);
    if (userId === viewerId)
      throw new BadRequestException('Choose another user');
    await this.users.get(userId, viewerId);
    const [participantAId, participantBId] = [viewerId, userId].sort();
    const conversation = await this.db.conversation.upsert({
      where: {
        participantAId_participantBId: { participantAId, participantBId },
      },
      create: { participantAId, participantBId },
      update: {},
    });
    return this.get(viewerId, conversation.id);
  }

  async messages(viewerId: string, id: string, cursor?: string) {
    await this.member(viewerId, id);
    if (
      cursor &&
      !(await this.db.message.findFirst({
        where: { id: cursor, conversationId: id },
      }))
    )
      throw new BadRequestException('Invalid cursor');
    const messages = await this.db.message.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 31,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rowsPage(messages, 30);
    return {
      ...page,
      items: page.items.map((message) => this.message(message)),
    };
  }

  async send(viewerId: string, id: string, body: unknown) {
    await this.member(viewerId, id);
    const input = record(body);
    const content = text(input.text, 'text', 2000);
    const message = await this.db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId: id, senderId: viewerId, text: content },
      });
      await tx.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      return message;
    });
    return this.message(message);
  }
}
