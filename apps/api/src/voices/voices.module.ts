import { Module } from '@nestjs/common';
import { VoicesController } from './voices.controller';
import { VoicesRepository } from './voices.repository';
import { VoicesService } from './voices.service';

@Module({ controllers: [VoicesController], providers: [VoicesRepository, VoicesService] })
export class VoicesModule {}
