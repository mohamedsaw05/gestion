import { Module } from '@nestjs/common';
import { PeripheralsController } from './peripherals.controller.js';
import { PeripheralsService } from './peripherals.service.js';

@Module({ controllers: [PeripheralsController], providers: [PeripheralsService] })
export class PeripheralsModule {}
