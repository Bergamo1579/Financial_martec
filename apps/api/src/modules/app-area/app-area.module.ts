import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { AppCadastrosController } from './cadastros.controller';
import { AppCadastrosService } from './cadastros.service';
import { AppCompaniesController } from './companies.controller';
import { AppCompaniesService } from './companies.service';
import { AppIndicacoesController } from './indicacoes.controller';
import { AppMatriculasController } from './matriculas.controller';
import { AppMatriculasService } from './matriculas.service';
import { AppPlanosPagamentoController } from './planos-pagamento.controller';
import { AppPlanosPagamentoService } from './planos-pagamento.service';

@Module({
  imports: [AuditModule],
  controllers: [
    AppCadastrosController,
    AppCompaniesController,
    AppIndicacoesController,
    AppMatriculasController,
    AppPlanosPagamentoController,
  ],
  providers: [
    AppCadastrosService,
    AppCompaniesService,
    AppMatriculasService,
    AppPlanosPagamentoService,
  ],
})
export class AppAreaModule {}
