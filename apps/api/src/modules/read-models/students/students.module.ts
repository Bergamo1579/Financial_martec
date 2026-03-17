import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { PedagogicalIntegrationModule } from '@/modules/integration/pedagogical/pedagogical.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [AuditModule, PedagogicalIntegrationModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
