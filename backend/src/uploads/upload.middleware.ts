import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import express from 'express';
import type { AuthService } from '../auth/auth.service.js';
import { config } from '../common/config.js';
import { MAX_UPLOAD_BYTES, UploadsService } from './uploads.service.js';

/** Authenticate and authorize before the raw parser can allocate video buffers. */
export function localUploadMiddleware(
  auth: AuthService,
  uploads: UploadsService,
) {
  let active = 0;
  const parse = express.raw({
    type: ['video/mp4', 'video/quicktime', 'video/webm'],
    limit: MAX_UPLOAD_BYTES,
  });
  return async (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) => {
    if (request.method !== 'PUT') {
      next();
      return;
    }
    try {
      if (!config.demoMode)
        throw new ForbiddenException(
          'Local uploads are available only in demo mode',
        );
      const match = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '');
      if (!match) throw new UnauthorizedException('Sign in to upload a video');
      const user = await auth.authenticate(match[1]);
      const id = request.params.id;
      if (typeof id !== 'string')
        throw new BadRequestException('Invalid upload id');
      const upload = await uploads.owner(user.id, id);
      if (upload.provider !== 'local')
        throw new ForbiddenException(
          'Send this video to its direct provider URL',
        );
      if (upload.status !== 'pending')
        throw new ConflictException('This upload has already been submitted');
      const contentType = request.headers['content-type']?.split(';')[0].trim();
      if (contentType !== upload.contentType)
        throw new BadRequestException(
          'Video content type does not match the upload',
        );
      if (Number(request.headers['content-length'] ?? 0) > MAX_UPLOAD_BYTES)
        throw new PayloadTooLargeException('Upload a video up to 100 MB');
      if (active >= 2)
        throw new HttpException(
          'Two videos are already uploading; try again shortly',
          429,
        );
      active += 1;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        active -= 1;
      };
      response.once('finish', release);
      response.once('close', release);
      parse(request, response, (error?: unknown) => {
        if (!error) { next(); return; }
        release();
        if (request.destroyed || (typeof error === 'object' && error !== null && 'type' in error && error.type === 'request.aborted')) return;
        const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
        if (status >= 400 && status < 500) {
          response.setHeader('Connection', 'close');
          response.status(status).json({ message: status === 413 ? 'Upload a video up to 100 MB' : 'Invalid video request body' });
          return;
        }
        next(error);
      });
    } catch (error) {
      // Close a rejected stream without consuming a large request body.
      response.setHeader('Connection', 'close');
      if (error instanceof HttpException) {
        const details = error.getResponse();
        response
          .status(error.getStatus())
          .json(typeof details === 'string' ? { message: details } : details);
      } else {
        next(error);
      }
    }
  };
}
