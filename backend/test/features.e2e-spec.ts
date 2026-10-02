import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac, randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module.js';
import { setup } from '../src/setup.js';
import { DatabaseService } from '../src/database/database.service.js';
import { UsersService } from '../src/users/users.service.js';
import { MessagesService } from '../src/messages/messages.service.js';
import { UploadsService } from '../src/uploads/uploads.service.js';
import { FeedService } from '../src/feed/feed.service.js';
import { config } from '../src/common/config.js';

describe('Functional API with PostgreSQL', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let alex: { token: string; user: { id: string } };
  let sam: { token: string; user: { id: string } };
  let videoId: string;
  const createdUsers: string[] = [];
  const createdVideos: string[] = [];
  const createdEvents: string[] = [];
  const createdUploads: string[] = [];

  beforeAll(async () => {
    if (!config.demoMode)
      throw new Error(
        'Integration tests require demo mode and an initialized database. Run npm run demo:test.',
      );
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ rawBody: true });
    setup(app);
    await app.init();
    db = app.get(DatabaseService);
    alex = (
      await request(app.getHttpServer())
        .post('/v1/demo/sessions')
        .send({ account: 'alex' })
        .expect(201)
    ).body;
    sam = (
      await request(app.getHttpServer())
        .post('/v1/demo/sessions')
        .send({ account: 'sam' })
        .expect(201)
    ).body;
    const video = await db.video.create({
      data: {
        source: 'SAMPLE',
        sourceId: `test-${randomUUID()}`,
        creatorName: 'Test source',
        playbackUrl: 'https://example.com/video.mp4',
        attributionUrl: 'https://example.com',
      },
    });
    videoId = video.id;
    createdVideos.push(video.id);
  }, 30000);

  afterAll(async () => {
    if (db) {
      await db.video.deleteMany({ where: { id: { in: createdVideos } } });
      await db.user.deleteMany({ where: { id: { in: createdUsers } } });
      await db.webhookEvent.deleteMany({
        where: { id: { in: createdEvents } },
      });
      await db.upload.deleteMany({ where: { id: { in: createdUploads } } });
    }
    await app?.close();
  });

  it('requires sessions and rejects tampered tokens', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/v1/me').expect(401);
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${alex.token}x`)
      .expect(401);
    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${alex.token}`)
      .expect(200);
    expect(me.body.id).toBe(alex.user.id);
    expect(alex.user.id).not.toBe(sam.user.id);
  });

  it('makes likes idempotent and scoped to the authenticated viewer', async () => {
    for (let count = 0; count < 2; count++)
      await request(app.getHttpServer())
        .put(`/v1/videos/${videoId}/like`)
        .set('Authorization', `Bearer ${alex.token}`)
        .expect(200);
    const result = await request(app.getHttpServer())
      .get(`/v1/videos/${videoId}`)
      .set('Authorization', `Bearer ${sam.token}`)
      .expect(200);
    expect(result.body).toMatchObject({
      likeCount: 1,
      viewerHasLiked: false,
      creator: { appUserId: null },
    });
    await request(app.getHttpServer())
      .delete(`/v1/videos/${videoId}/like`)
      .set('Authorization', `Bearer ${sam.token}`)
      .expect(200);
    expect(await db.like.count({ where: { videoId } })).toBe(1);
  });

  it('derives comment authors from the token and persists them across clients', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/videos/${videoId}/comments`)
      .set('Authorization', `Bearer ${alex.token}`)
      .send({ text: 'Persistent comment', authorId: sam.user.id })
      .expect(201);
    expect(response.body.author.id).toBe(alex.user.id);
    const otherClient = new DatabaseService();
    try {
      await otherClient.$connect();
      expect(
        await otherClient.comment.findUnique({
          where: { id: response.body.id },
        }),
      ).toMatchObject({ authorId: alex.user.id, text: 'Persistent comment' });
    } finally {
      await otherClient.$disconnect();
    }
    await request(app.getHttpServer())
      .post(`/v1/videos/${videoId}/comments`)
      .set('Authorization', `Bearer ${alex.token}`)
      .send({ text: ' '.repeat(10) })
      .expect(400);
  });

  it('enforces unique unordered conversation pairs and members-only messages', async () => {
    const users = app.get(UsersService);
    const messages = app.get(MessagesService);
    const identities = await Promise.all(
      [0, 1, 2].map((index) => users.identity(`test:${randomUUID()}:${index}`)),
    );
    createdUsers.push(...identities.map((user) => user.id));
    const [a, b, outsider] = identities;
    const [first, second] = await Promise.all([
      messages.create(a.id, { userId: b.id }),
      messages.create(b.id, { userId: a.id }),
    ]);
    expect(first.id).toBe(second.id);
    await messages.send(a.id, first.id, {
      text: 'Hello from A',
      senderId: outsider.id,
    });
    expect((await messages.messages(b.id, first.id)).items[0]).toMatchObject({
      senderId: a.id,
      text: 'Hello from A',
    });
    await expect(messages.messages(outsider.id, first.id)).rejects.toThrow(
      'This conversation is private',
    );
    await expect(
      messages.send(outsider.id, first.id, { text: 'Intrusion' }),
    ).rejects.toThrow('This conversation is private');
    await expect(messages.create(a.id, { userId: a.id })).rejects.toThrow(
      'Choose another user',
    );
    await db.message.createMany({
      data: Array.from({ length: 34 }, (_, index) => ({
        conversationId: first.id,
        senderId: b.id,
        text: `Paged message ${index}`,
      })),
    });
    const pageOne = await messages.messages(a.id, first.id);
    expect(pageOne.items).toHaveLength(30);
    const pageTwo = await messages.messages(
      a.id,
      first.id,
      pageOne.nextCursor!,
    );
    expect(pageTwo.items).toHaveLength(5);
    expect(pageTwo.nextCursor).toBeNull();
    expect(
      new Set([...pageOne.items, ...pageTwo.items].map((message) => message.id))
        .size,
    ).toBe(35);
  });

  it('rejects self-follow and preserves unique follows', async () => {
    await request(app.getHttpServer())
      .put(`/v1/users/${alex.user.id}/follow`)
      .set('Authorization', `Bearer ${alex.token}`)
      .expect(400);
    const users = app.get(UsersService);
    const target = await users.identity(`test:${randomUUID()}`);
    createdUsers.push(target.id);
    await Promise.all([
      users.follow(alex.user.id, target.id, true),
      users.follow(alex.user.id, target.id, true),
    ]);
    expect(
      await db.follow.count({
        where: { followerId: alex.user.id, followedId: target.id },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .patch('/v1/me')
      .set('Authorization', `Bearer ${alex.token}`)
      .send({ username: 'Bad name!' })
      .expect(400);
  });

  it('only records meaningful views', async () => {
    await request(app.getHttpServer())
      .post(`/v1/videos/${videoId}/views`)
      .set('Authorization', `Bearer ${sam.token}`)
      .send({ watchDurationMs: 20, completed: false })
      .expect(201);
    expect(
      await db.videoView.count({ where: { videoId, userId: sam.user.id } }),
    ).toBe(0);
    await request(app.getHttpServer())
      .post(`/v1/videos/${videoId}/views`)
      .set('Authorization', `Bearer ${sam.token}`)
      .send({ watchDurationMs: 4000, completed: false })
      .expect(201);
    const history = await request(app.getHttpServer())
      .get('/v1/me/history')
      .set('Authorization', `Bearer ${sam.token}`)
      .expect(200);
    expect(
      history.body.items.some((video: { id: string }) => video.id === videoId),
    ).toBe(true);
  });

  it('rejects cross-user upload access and mislabeled content', async () => {
    const uploads = app.get(UploadsService);
    const owner = await app.get(UsersService).identity(`test:${randomUUID()}`);
    createdUsers.push(owner.id);
    const upload = await uploads.create(owner.id, {
      caption: 'Test',
      contentType: 'video/mp4',
    });
    await expect(uploads.get(sam.user.id, upload.id)).rejects.toThrow(
      'This upload belongs to another account',
    );
    await expect(
      uploads.content(
        owner.id,
        upload.id,
        Buffer.from('not a video file'),
        'video/mp4',
      ),
    ).rejects.toThrow('Video content does not match');
    expect((await uploads.get(owner.id, upload.id)).status).toBe('pending');
  });

  it('changes recommendation order when a viewer follows an app creator', async () => {
    const users = app.get(UsersService);
    const viewer = await users.identity(`test:${randomUUID()}`);
    const creator = await users.identity(`test:${randomUUID()}`);
    createdUsers.push(viewer.id, creator.id);
    const older = await db.video.create({
      data: {
        source: 'LOCAL',
        sourceId: `test-${randomUUID()}`,
        ownerId: creator.id,
        creatorName: creator.displayName,
        playbackUrl: 'https://example.com/old.mp4',
        createdAt: new Date('2020-01-01'),
      },
    });
    const newer = await db.video.create({
      data: {
        source: 'SAMPLE',
        sourceId: `test-${randomUUID()}`,
        creatorName: 'External source',
        playbackUrl: 'https://example.com/new.mp4',
        createdAt: new Date('2021-01-01'),
      },
    });
    createdVideos.push(older.id, newer.id);
    const feed = app.get(FeedService);
    const before = (await feed.list(viewer.id, 'recommended')).items.map(
      (video) => video.id,
    );
    expect(before.indexOf(newer.id)).toBeLessThan(before.indexOf(older.id));
    await users.follow(viewer.id, creator.id, true);
    const after = (await feed.list(viewer.id, 'recommended')).items.map(
      (video) => video.id,
    );
    expect(after.indexOf(older.id)).toBeLessThan(after.indexOf(newer.id));
  });

  it('only publishes Mux assets after a verified ready event and deduplicates delivery', async () => {
    const owner = await app.get(UsersService).identity(`test:${randomUUID()}`);
    createdUsers.push(owner.id);
    const providerId = `upload_${randomUUID()}`;
    const upload = await db.upload.create({
      data: {
        ownerId: owner.id,
        caption: 'Mux boundary test',
        contentType: 'video/mp4',
        provider: 'mux',
        providerId,
      },
    });
    const uploads = app.get(UploadsService);
    const oldSecret = config.muxWebhookSecret;
    config.muxWebhookSecret = 'integration-test-webhook-secret';
    try {
      const eventId = `event_${randomUUID()}`;
      createdEvents.push(eventId);
      const raw = Buffer.from(
        JSON.stringify({
          id: eventId,
          type: 'video.asset.ready',
          data: {
            id: `asset_${randomUUID()}`,
            upload_id: providerId,
            passthrough: upload.id,
            playback_ids: [{ policy: 'public', id: 'test_public_playback' }],
          },
        }),
      );
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac('sha256', config.muxWebhookSecret)
        .update(`${timestamp}.`)
        .update(raw)
        .digest('hex');
      await expect(
        uploads.webhook(raw, `t=${timestamp},v1=0000`),
      ).rejects.toThrow('Invalid webhook signature');
      expect((await uploads.get(owner.id, upload.id)).status).toBe('pending');
      await uploads.webhook(raw, `t=${timestamp},v1=${signature}`);
      const ready = await uploads.get(owner.id, upload.id);
      expect(ready.status).toBe('ready');
      expect(ready.videoId).toBeTruthy();
      createdVideos.push(ready.videoId!);
      await uploads.webhook(raw, `t=${timestamp},v1=${signature}`);
      expect(await db.video.count({ where: { id: ready.videoId! } })).toBe(1);
      expect(await db.webhookEvent.count({ where: { id: eventId } })).toBe(1);
    } finally {
      config.muxWebhookSecret = oldSecret;
    }
  });

  it('paginates distinct watch history without repeating older views of the same video', async () => {
    const viewer = await app.get(UsersService).identity(`test:${randomUUID()}`);
    createdUsers.push(viewer.id);
    const videos = await db.video.createManyAndReturn({
      data: Array.from({ length: 14 }, () => ({
        source: 'SAMPLE' as const,
        sourceId: `test-${randomUUID()}`,
        creatorName: 'History test source',
        playbackUrl: 'https://example.com/test.mp4',
      })),
    });
    createdVideos.push(...videos.map((video) => video.id));
    await db.videoView.createMany({
      data: videos.map((video, index) => ({
        userId: viewer.id,
        videoId: video.id,
        watchDurationMs: 4000,
        completed: false,
        viewedAt: new Date(Date.UTC(2020, 0, index + 1)),
      })),
    });
    await db.videoView.create({
      data: {
        userId: viewer.id,
        videoId: videos[0].id,
        watchDurationMs: 8000,
        completed: true,
        viewedAt: new Date('2025-01-01'),
      },
    });
    const feed = app.get(FeedService);
    const first = await feed.history(viewer.id);
    expect(first.items).toHaveLength(12);
    expect(first.items[0].id).toBe(videos[0].id);
    const second = await feed.history(viewer.id, first.nextCursor!);
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((video) => video.id)).size,
    ).toBe(14);
  });
  it('keeps recommendation pages stable while watching and liking the first page', async () => {
    const viewer = await app.get(UsersService).identity(`test:${randomUUID()}`);
    const outsider = await app
      .get(UsersService)
      .identity(`test:${randomUUID()}`);
    createdUsers.push(viewer.id, outsider.id);
    const videos = await db.video.createManyAndReturn({
      data: Array.from({ length: 14 }, (_, index) => ({
        source: 'SAMPLE' as const,
        sourceId: `test-${randomUUID()}`,
        creatorName: 'Pagination regression',
        playbackUrl: 'https://example.com/test.mp4',
        createdAt: new Date(Date.UTC(2030, 0, index + 1)),
      })),
    });
    createdVideos.push(...videos.map((video) => video.id));
    const feed = app.get(FeedService);
    const first = await feed.list(viewer.id, 'recommended');
    expect(first.items).toHaveLength(12);
    expect(first.nextCursor).toBeTruthy();
    for (const video of first.items)
      await feed.view(viewer.id, video.id, {
        watchDurationMs: 5000,
        completed: false,
      });
    await db.like.create({
      data: { userId: viewer.id, videoId: first.items[0].id },
    });
    const seen = new Set(first.items.map((video) => video.id));
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await feed.list(viewer.id, 'recommended', cursor);
      for (const video of page.items) {
        expect(seen.has(video.id)).toBe(false);
        seen.add(video.id);
      }
      cursor = page.nextCursor;
    }
    for (const video of videos) expect(seen.has(video.id)).toBe(true);
    await expect(
      feed.list(outsider.id, 'recommended', first.nextCursor!),
    ).rejects.toThrow('Feed session expired');
    const snapshotId = first.nextCursor!.split(':')[1];
    await db.feedSnapshot.update({
      where: { id: snapshotId },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      feed.list(viewer.id, 'recommended', first.nextCursor!),
    ).rejects.toThrow('Feed session expired');
  });

  it('rejects unauthorized video headers before buffering a large body and limits concurrent streams', async () => {
    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as AddressInfo).port;
    const uploads = await Promise.all(
      [0, 1, 2].map(() =>
        app
          .get(UploadsService)
          .create(alex.user.id, {
            caption: 'Upload middleware test',
            contentType: 'video/mp4',
          }),
      ),
    );
    createdUploads.push(...uploads.map((upload) => upload.id));
    const headersOnly = (
      id: string,
      token?: string,
      length = 101 * 1024 * 1024,
    ) =>
      new Promise<number>((resolve, reject) => {
        const client = httpRequest(
          {
            host: '127.0.0.1',
            port,
            path: `/v1/uploads/${id}/content`,
            method: 'PUT',
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': length,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
          (response) => {
            response.resume();
            response.once('end', () => {
              resolve(response.statusCode!);
              client.destroy();
            });
          },
        );
        client.once('error', reject);
        client.setTimeout(1500, () => {
          client.destroy(
            new Error(
              'Server waited for upload bytes before rejecting headers',
            ),
          );
        });
        client.flushHeaders();
      });
    expect(await headersOnly(uploads[0].id)).toBe(401);
    expect(await headersOnly(uploads[0].id, 'invalid-token')).toBe(401);
    expect(await headersOnly(uploads[0].id, sam.token)).toBe(403);
    expect(await headersOnly(uploads[0].id, alex.token)).toBe(413);
    const oldDemo = config.demoMode;
    config.demoMode = false;
    try {
      expect(await headersOnly(uploads[0].id)).toBe(403);
    } finally {
      config.demoMode = oldDemo;
    }

    const blocked = uploads.slice(0, 2).map((upload) => {
      const client = httpRequest({
        host: '127.0.0.1',
        port,
        path: `/v1/uploads/${upload.id}/content`,
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': 12,
          Authorization: `Bearer ${alex.token}`,
        },
      });
      client.on('error', () => undefined);
      client.flushHeaders();
      return client;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(await headersOnly(uploads[2].id, alex.token, 12)).toBe(429);
    } finally {
      blocked.forEach((client) => client.destroy());
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    // An empty, authorized body reaches validation after both abandoned slots release.
    expect(await headersOnly(uploads[2].id, alex.token, 0)).toBe(400);
  });
});
