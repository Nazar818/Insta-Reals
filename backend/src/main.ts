import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { config } from './common/config.js';
import { setup } from './setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  setup(app);
  await app.listen(config.port, '0.0.0.0');
}
await bootstrap();
