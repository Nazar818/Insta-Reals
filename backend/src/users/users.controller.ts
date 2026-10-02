import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';

@Controller()
export class UsersController {
  @Get('me')
  @UseGuards(ClerkAuthGuard)
  getMe(@Req() request: AuthenticatedRequest): { clerkUserId: string } {
    return { clerkUserId: request.clerkUserId! };
  }
}
