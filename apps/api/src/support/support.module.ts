import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module.js';
import { SupportController, PlatformSupportController } from './support.controller.js';
import { SupportService } from './support.service.js';

@Module({ imports: [PlatformModule], controllers: [SupportController, PlatformSupportController], providers: [SupportService] })
export class SupportModule {}
