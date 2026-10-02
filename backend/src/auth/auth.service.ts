import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../common/config.js';
import { record } from '../common/validation.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AuthService {
  private secretPromise?: Promise<Buffer>;
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  private secret() {
    this.secretPromise ??= (async () => {
      await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
      const path = join(config.dataDir, 'demo-signing-secret');
      try {
        return await readFile(path);
      } catch {
        try {
          await writeFile(path, randomBytes(48), { flag: 'wx', mode: 0o600 });
        } catch (error) {
          if (!(
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'EEXIST'
          ))
            throw error;
        }
        return readFile(path);
      }
    })();
    return this.secretPromise;
  }

  async demoSession(body: unknown) {
    if (!config.demoMode) throw new NotFoundException();
    const input = record(body);
    if (input.account !== 'alex' && input.account !== 'sam')
      throw new UnauthorizedException('Choose alex or sam');
    const user = await this.users.identity(`demo:${input.account}`);
    // The token is explicitly namespaced and never accepted by a deployed backend.
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.clerkId,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', await this.secret())
      .update(payload)
      .digest('base64url');
    return {
      token: `demo.${payload}.${signature}`,
      user: await this.users.get(user.id, user.id),
    };
  }

  async authenticate(token: string) {
    if (token.startsWith('demo.')) {
      if (!config.demoMode)
        throw new UnauthorizedException('Demo authentication is disabled');
      const parts = token.split('.');
      if (parts.length !== 3)
        throw new UnauthorizedException('Invalid session');
      const expected = createHmac('sha256', await this.secret())
        .update(parts[1])
        .digest();
      const provided = Buffer.from(parts[2], 'base64url');
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(expected, provided)
      )
        throw new UnauthorizedException('Invalid session');
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString(),
        ) as { sub?: string; exp?: number };
        if (
          (payload.sub !== 'demo:alex' && payload.sub !== 'demo:sam') ||
          typeof payload.exp !== 'number' ||
          payload.exp <= Date.now() / 1000
        )
          throw new Error('expired');
        return this.users.identity(payload.sub);
      } catch {
        throw new UnauthorizedException('Session expired; sign in again');
      }
    }
    if (!config.clerkSecretKey && !config.clerkJwtKey)
      throw new UnauthorizedException('Clerk authentication is not configured');
    try {
      const payload = await verifyToken(token, {
        secretKey: config.clerkSecretKey,
        jwtKey: config.clerkJwtKey,
        authorizedParties: config.clerkAuthorizedParties,
      });
      let name: string | undefined;
      let avatar: string | undefined;
      if (config.clerkSecretKey) {
        const clerkUser = await createClerkClient({
          secretKey: config.clerkSecretKey,
        }).users.getUser(payload.sub);
        name =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
          clerkUser.username ||
          undefined;
        avatar = clerkUser.imageUrl;
      }
      return this.users.identity(payload.sub, name, avatar);
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
