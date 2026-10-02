import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from './auth/clerk-auth.guard.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersController } from './users/users.controller.js';

@Module({
  imports: [],
  controllers: [AppController, UsersController],
  providers: [AppService, ClerkAuthGuard],
})
export class AppModule {}
