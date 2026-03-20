import { BadRequestException } from '@nestjs/common';
import { AppPlanosPagamentoService } from './planos-pagamento.service';

describe('AppPlanosPagamentoService', () => {
  it('rejects invalid payment plan values before persisting', async () => {
    const service = new AppPlanosPagamentoService(
      {
        planoPagamento: {
          create: jest.fn(),
        },
      } as never,
      {
        record: jest.fn(),
      } as never,
    );

    await expect(
      service.create(
        {
          nome: 'Plano invalido',
          valorTotal: 0,
          quantidadeMeses: 0,
          diaVencimento: 45,
          status: 'ATIVO',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps persisted payment plans into the public catalog contract', async () => {
    const service = new AppPlanosPagamentoService(
      {
        planoPagamento: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'plan-1',
              nome: 'Plano 12x',
              valorTotal: { toString: () => '1500.50' },
              quantidadeMeses: 12,
              diaVencimento: 10,
              status: 'ATIVO',
              createdAt: new Date('2026-03-20T08:00:00.000Z'),
              updatedAt: new Date('2026-03-20T09:00:00.000Z'),
            },
          ]),
          count: jest.fn().mockResolvedValue(1),
          findUnique: jest.fn().mockResolvedValue({
            id: 'plan-1',
            nome: 'Plano 12x',
            valorTotal: { toString: () => '1500.50' },
            quantidadeMeses: 12,
            diaVencimento: 10,
            status: 'ATIVO',
            createdAt: new Date('2026-03-20T08:00:00.000Z'),
            updatedAt: new Date('2026-03-20T09:00:00.000Z'),
          }),
        },
      } as never,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    const page = await service.list({ page: 1, pageSize: 20 }, 'user-1');
    const detail = await service.findOne('plan-1', 'user-1');

    expect(page.items[0]).toMatchObject({
      id: 'plan-1',
      valorTotal: 1500.5,
      quantidadeMeses: 12,
      diaVencimento: 10,
      status: 'ATIVO',
    });
    expect(detail.usoFuturoEsperado).toHaveLength(3);
  });
});
