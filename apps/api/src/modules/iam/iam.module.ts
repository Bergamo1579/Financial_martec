import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { IamCatalogSyncService } from './iam-catalog-sync.service';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';

@Module({
  imports: [AuditModule],
  controllers: [IamController],
  providers: [IamService, IamCatalogSyncService],
  exports: [IamService],
})
export class IamModule {}
