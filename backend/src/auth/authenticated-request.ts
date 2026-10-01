import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  clerkUserId?: string;
};
