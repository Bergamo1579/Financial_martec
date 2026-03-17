import { Module } from '@nestjs/common';
import { PedagogicalIntegrationModule } from '@/modules/integration/pedagogical/pedagogical.module';
import { InternalSyncGuard } from './internal-sync.guard';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [PedagogicalIntegrationModule],
  controllers: [SyncController],
  providers: [SyncService, InternalSyncGuard],
})
export class SyncModule {}
