import 'dotenv/config';
import { resolve } from 'node:path';

export const config = {
  demoMode: process.env.DEMO_MODE === 'true',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  publicUrl: (process.env.API_PUBLIC_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  ),
  dataDir: resolve(process.env.DATA_DIR ?? '.data'),
  clerkSecretKey: process.env.CLERK_SECRET_KEY,
  clerkJwtKey: process.env.CLERK_JWT_KEY,
  clerkAuthorizedParties:
    process.env.CLERK_AUTHORIZED_PARTIES?.split(',').filter(Boolean),
  pexelsKey: process.env.PEXELS_API_KEY,
  muxTokenId: process.env.MUX_TOKEN_ID,
  muxTokenSecret: process.env.MUX_TOKEN_SECRET,
  muxWebhookSecret: process.env.MUX_WEBHOOK_SECRET,
};

if (config.demoMode && process.env.NODE_ENV === 'production') {
  throw new Error('DEMO_MODE cannot be enabled in production');
}

export function hasMux() {
  return Boolean(
    config.muxTokenId && config.muxTokenSecret && config.muxWebhookSecret,
  );
}
