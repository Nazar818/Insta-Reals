import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public, Viewer } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { config, hasMux } from './common/config.js';
import { UsersService } from './users/users.service.js';
import { FeedService } from './feed/feed.service.js';
import { InteractionsService } from './interactions/interactions.service.js';
import { MessagesService } from './messages/messages.service.js';
import { UploadsService } from './uploads/uploads.service.js';

@Controller()
export class ApiController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(FeedService) private readonly feed: FeedService,
    @Inject(InteractionsService) private readonly social: InteractionsService,
    @Inject(MessagesService) private readonly messages: MessagesService,
    @Inject(UploadsService) private readonly uploads: UploadsService,
  ) {}

  @Public() @Get('config') configuration() {
    return {
      demoMode: config.demoMode,
      uploadProvider: hasMux() ? 'mux' : 'local',
    };
  }
  @Public() @Post('demo/sessions') demo(@Body() body: unknown) {
    return this.auth.demoSession(body);
  }
  @Get('me') me(@Viewer() viewer: string) {
    return this.users.get(viewer, viewer);
  }
  @Patch('me') profile(@Viewer() viewer: string, @Body() body: unknown) {
    return this.users.patch(viewer, body);
  }
  @Get('users') search(
    @Viewer() viewer: string,
    @Query('query') query?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.users.search(viewer, query, cursor);
  }
  @Get('users/:id') user(@Viewer() viewer: string, @Param('id') id: string) {
    return this.users.get(id, viewer);
  }
  @Get('users/:id/videos') userVideos(
    @Viewer() viewer: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.feed.list(viewer, 'discover', cursor, id);
  }
  @Put('users/:id/follow') follow(
    @Viewer() viewer: string,
    @Param('id') id: string,
  ) {
    return this.users.follow(viewer, id, true);
  }
  @Delete('users/:id/follow') unfollow(
    @Viewer() viewer: string,
    @Param('id') id: string,
  ) {
    return this.users.follow(viewer, id, false);
  }
  @Get('feed') videos(
    @Viewer() viewer: string,
    @Query('mode') mode?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.feed.list(viewer, mode, cursor);
  }
  @Get('videos/:id') video(@Viewer() viewer: string, @Param('id') id: string) {
    return this.feed.get(id, viewer);
  }
  @Put('videos/:id/like') like(
    @Viewer() viewer: string,
    @Param('id') id: string,
  ) {
    return this.social.like(viewer, id, true);
  }
  @Delete('videos/:id/like') unlike(
    @Viewer() viewer: string,
    @Param('id') id: string,
  ) {
    return this.social.like(viewer, id, false);
  }
  @Get('videos/:id/comments') comments(
    @Viewer() viewer: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.social.comments(viewer, id, cursor);
  }
  @Post('videos/:id/comments') comment(
    @Viewer() viewer: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.social.comment(viewer, id, body);
  }
  @Post('videos/:id/views') view(
    @Viewer() viewer: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.feed.view(viewer, id, body);
  }
  @Get('me/history') history(
    @Viewer() viewer: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.feed.history(viewer, cursor);
  }
  @Get('conversations') inbox(
    @Viewer() viewer: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messages.list(viewer, cursor);
  }
  @Post('conversations') conversation(
    @Viewer() viewer: string,
    @Body() body: unknown,
  ) {
    return this.messages.create(viewer, body);
  }
  @Get('conversations/:id/messages') chat(
    @Viewer() viewer: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messages.messages(viewer, id, cursor);
  }
  @Post('conversations/:id/messages') message(
    @Viewer() viewer: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.messages.send(viewer, id, body);
  }
  @Post('uploads') upload(@Viewer() viewer: string, @Body() body: unknown) {
    return this.uploads.create(viewer, body);
  }
  @Get('uploads/:id') uploadStatus(
    @Viewer() viewer: string,
    @Param('id') id: string,
  ) {
    return this.uploads.get(viewer, id);
  }
  @Put('uploads/:id/content') uploadContent(
    @Viewer() viewer: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('content-type') mime?: string,
  ) {
    return this.uploads.content(viewer, id, body, mime);
  }
  @Public() @Post('webhooks/mux') webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('mux-signature') signature?: string,
  ) {
    return this.uploads.webhook(request.rawBody ?? Buffer.alloc(0), signature);
  }
}
