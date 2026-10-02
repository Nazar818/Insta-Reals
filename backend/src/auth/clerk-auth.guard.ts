import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { AuthenticatedRequest } from './authenticated-request.js';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];

    if (!token) {
      throw new UnauthorizedException('A Clerk bearer token is required.');
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new ServiceUnavailableException(
        'Clerk authentication is not configured.',
      );
    }

    const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES?.split(',')
      .map((party) => party.trim())
      .filter(Boolean);

    let clerkUserId: string | undefined;
    try {
      const verified = await verifyToken(token, {
        secretKey,
        ...(authorizedParties?.length ? { authorizedParties } : {}),
      });
      const subject =
        typeof verified.data === 'object' &&
        verified.data !== null &&
        'sub' in verified.data
          ? verified.data.sub
          : undefined;
      clerkUserId = typeof subject === 'string' ? subject : undefined;
    } catch {
      throw new UnauthorizedException('The Clerk bearer token is invalid.');
    }

    if (!clerkUserId) {
      throw new UnauthorizedException('The Clerk bearer token is invalid.');
    }

    request.clerkUserId = clerkUserId;
    return true;
  }
}
