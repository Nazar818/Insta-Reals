import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/auth.guard.js';

@Controller('health')
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Public()
  @Get()
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
