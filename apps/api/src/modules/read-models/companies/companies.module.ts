import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { PedagogicalIntegrationModule } from '@/modules/integration/pedagogical/pedagogical.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuditModule, PedagogicalIntegrationModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
