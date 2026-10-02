import type { INestApplication } from '@nestjs/common';
import express from 'express';
import { join } from 'node:path';
import { config } from './common/config.js';
import { AuthService } from './auth/auth.service.js';
import { UploadsService } from './uploads/uploads.service.js';
import { localUploadMiddleware } from './uploads/upload.middleware.js';

export function setup(app: INestApplication) {
  app.setGlobalPrefix('v1');
  app.use(
    '/v1',
    (
      request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      if (
        Object.values(request.query).some(
          (value) => typeof value !== 'string' || value.length > 500,
        )
      ) {
        response.status(400).json({
          message: 'Query parameters must be strings up to 500 characters',
        });
        return;
      }
      next();
    },
  );
  app.enableCors({
    origin: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use(
    '/v1/uploads/:id/content',
    localUploadMiddleware(app.get(AuthService), app.get(UploadsService)),
  );
  if (config.demoMode)
    app.use(
      '/v1/media',
      express.static(join(config.dataDir, 'videos'), {
        fallthrough: false,
        dotfiles: 'deny',
        immutable: true,
        maxAge: '1d',
        setHeaders: (response) =>
          response.setHeader('X-Content-Type-Options', 'nosniff'),
      }),
    );
  app.enableShutdownHooks();
}
