-- CreateEnum
CREATE TYPE "CadastroStatus" AS ENUM ('ARQUIVADO', 'ENVIADO', 'ACEITO', 'CONTRATO', 'MATRICULADO');

-- CreateEnum
CREATE TYPE "StudyPeriod" AS ENUM ('MANHA', 'TARDE', 'NOITE', 'INTEGRAL');

-- CreateEnum
CREATE TYPE "IndicacaoStatus" AS ENUM ('ENVIADA', 'ACEITA', 'RECUSADA', 'CONTRATO_GERADO', 'ENCERRADA_POR_OUTRA_EMPRESA');

-- CreateEnum
CREATE TYPE "PlanoPagamentoStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateTable
CREATE TABLE "Cadastro" (
  "id" TEXT NOT NULL,
  "nomeCompleto" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "cpfNormalized" TEXT NOT NULL,
  "nomeResponsavel" TEXT NOT NULL,
  "periodoEstudo" "StudyPeriod" NOT NULL,
  "status" "CadastroStatus" NOT NULL DEFAULT 'ARQUIVADO',
  "pedagogicalStudentSourceId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cadastro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicacao" (
  "id" TEXT NOT NULL,
  "cadastroId" TEXT NOT NULL,
  "empresaSourceId" TEXT NOT NULL,
  "status" "IndicacaoStatus" NOT NULL DEFAULT 'ENVIADA',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "contractGeneratedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Indicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoPagamento" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "valorTotal" DECIMAL(12,2) NOT NULL,
  "quantidadeMeses" INTEGER NOT NULL,
  "diaVencimento" INTEGER NOT NULL,
  "status" "PlanoPagamentoStatus" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalUnitSnapshot" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "payloadHash" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PedagogicalUnitSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalClassSnapshot" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "unitSourceId" TEXT,
  "unitSnapshotId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "payloadHash" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PedagogicalClassSnapshot_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PedagogicalStudentSnapshot"
ADD COLUMN "classSourceId" TEXT,
ADD COLUMN "unitSourceId" TEXT,
ADD COLUMN "classSnapshotId" TEXT,
ADD COLUMN "unitSnapshotId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cadastro_pedagogicalStudentSourceId_key" ON "Cadastro"("pedagogicalStudentSourceId");

-- CreateIndex
CREATE INDEX "Cadastro_cpfNormalized_idx" ON "Cadastro"("cpfNormalized");

-- CreateIndex
CREATE INDEX "Cadastro_status_updatedAt_idx" ON "Cadastro"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Cadastro_deletedAt_updatedAt_idx" ON "Cadastro"("deletedAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cadastro_active_cpf_key" ON "Cadastro"("cpfNormalized") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Indicacao_cadastroId_status_idx" ON "Indicacao"("cadastroId", "status");

-- CreateIndex
CREATE INDEX "Indicacao_empresaSourceId_status_idx" ON "Indicacao"("empresaSourceId", "status");

-- CreateIndex
CREATE INDEX "Indicacao_status_updatedAt_idx" ON "Indicacao"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Indicacao_open_cadastro_empresa_key"
ON "Indicacao"("cadastroId", "empresaSourceId")
WHERE "status" IN ('ENVIADA'::"IndicacaoStatus", 'ACEITA'::"IndicacaoStatus", 'CONTRATO_GERADO'::"IndicacaoStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoPagamento_nome_key" ON "PlanoPagamento"("nome");

-- CreateIndex
CREATE INDEX "PlanoPagamento_status_updatedAt_idx" ON "PlanoPagamento"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PedagogicalUnitSnapshot_batchId_sourceId_key" ON "PedagogicalUnitSnapshot"("batchId", "sourceId");

-- CreateIndex
CREATE INDEX "PedagogicalUnitSnapshot_batchId_name_idx" ON "PedagogicalUnitSnapshot"("batchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PedagogicalClassSnapshot_batchId_sourceId_key" ON "PedagogicalClassSnapshot"("batchId", "sourceId");

-- CreateIndex
CREATE INDEX "PedagogicalClassSnapshot_batchId_unitSourceId_idx" ON "PedagogicalClassSnapshot"("batchId", "unitSourceId");

-- CreateIndex
CREATE INDEX "PedagogicalClassSnapshot_batchId_name_idx" ON "PedagogicalClassSnapshot"("batchId", "name");

-- CreateIndex
CREATE INDEX "PedagogicalStudentSnapshot_batchId_classSourceId_idx" ON "PedagogicalStudentSnapshot"("batchId", "classSourceId");

-- CreateIndex
CREATE INDEX "PedagogicalStudentSnapshot_batchId_unitSourceId_idx" ON "PedagogicalStudentSnapshot"("batchId", "unitSourceId");

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_cadastroId_fkey" FOREIGN KEY ("cadastroId") REFERENCES "Cadastro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalUnitSnapshot" ADD CONSTRAINT "PedagogicalUnitSnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PedagogicalSnapshotBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalClassSnapshot" ADD CONSTRAINT "PedagogicalClassSnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PedagogicalSnapshotBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalClassSnapshot" ADD CONSTRAINT "PedagogicalClassSnapshot_unitSnapshotId_fkey" FOREIGN KEY ("unitSnapshotId") REFERENCES "PedagogicalUnitSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalStudentSnapshot" ADD CONSTRAINT "PedagogicalStudentSnapshot_classSnapshotId_fkey" FOREIGN KEY ("classSnapshotId") REFERENCES "PedagogicalClassSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalStudentSnapshot" ADD CONSTRAINT "PedagogicalStudentSnapshot_unitSnapshotId_fkey" FOREIGN KEY ("unitSnapshotId") REFERENCES "PedagogicalUnitSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
