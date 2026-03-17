import { Module } from '@nestjs/common';
import { PedagogicalClientService } from './pedagogical.client';
import { PedagogicalProjectionService } from './pedagogical.projection.service';

@Module({
  providers: [PedagogicalClientService, PedagogicalProjectionService],
  exports: [PedagogicalClientService, PedagogicalProjectionService],
})
export class PedagogicalIntegrationModule {}
