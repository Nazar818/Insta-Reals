import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { APP_GUARD } from '@nestjs/core';
import { ApiController } from './api.controller.js';
import { DatabaseService } from './database/database.service.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { UsersService } from './users/users.service.js';
import { FeedService } from './feed/feed.service.js';
import { InteractionsService } from './interactions/interactions.service.js';
import { MessagesService } from './messages/messages.service.js';
import { UploadsService } from './uploads/uploads.service.js';
import { PexelsService } from './providers/pexels.service.js';
import { MuxService } from './providers/mux.service.js';

@Module({
  imports: [],
  controllers: [AppController, ApiController],
  providers: [
    AppService,
    DatabaseService,
    AuthService,
    UsersService,
    FeedService,
    InteractionsService,
    MessagesService,
    UploadsService,
    PexelsService,
    MuxService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
