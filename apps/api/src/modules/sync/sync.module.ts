import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { PedagogicalIntegrationModule } from '@/modules/integration/pedagogical/pedagogical.module';
import { InternalSyncGuard } from './internal-sync.guard';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuditModule, PedagogicalIntegrationModule],
  controllers: [SyncController],
  providers: [SyncService, InternalSyncGuard],
})
export class SyncModule {}
