import { ConflictException } from '@nestjs/common';
import { AppCadastrosService } from './cadastros.service';

describe('AppCadastrosService', () => {
  it('rejects cadastro creation when an active CPF already exists', async () => {
    const service = new AppCadastrosService(
      {
        cadastro: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'existing-cadastro',
          }),
        },
      } as never,
      {
        record: jest.fn(),
      } as never,
    );

    await expect(
      service.create(
        {
          nomeCompleto: 'Novo Cadastro',
          telefone: '11999999999',
          cpf: '123.456.789-00',
          nomeResponsavel: 'Responsavel',
          periodoEstudo: 'MANHA',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns mapped operational flags on list responses', async () => {
    const service = new AppCadastrosService(
      {
        cadastro: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'cad-1',
              nomeCompleto: 'Cadastro 1',
              telefone: '11999999999',
              cpf: '12345678900',
              nomeResponsavel: 'Responsavel 1',
              periodoEstudo: 'MANHA',
              status: 'ARQUIVADO',
              pedagogicalStudentSourceId: null,
              deletedAt: null,
              createdAt: new Date('2026-03-20T08:00:00.000Z'),
              updatedAt: new Date('2026-03-20T09:00:00.000Z'),
              _count: {
                indicacoes: 0,
              },
            },
            {
              id: 'cad-2',
              nomeCompleto: 'Cadastro 2',
              telefone: '11888888888',
              cpf: '22345678900',
              nomeResponsavel: 'Responsavel 2',
              periodoEstudo: 'NOITE',
              status: 'ENVIADO',
              pedagogicalStudentSourceId: null,
              deletedAt: null,
              createdAt: new Date('2026-03-20T08:00:00.000Z'),
              updatedAt: new Date('2026-03-20T09:00:00.000Z'),
              _count: {
                indicacoes: 1,
              },
            },
          ]),
          count: jest.fn().mockResolvedValue(2),
        },
      } as never,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    const page = await service.list({ page: 1, pageSize: 20 }, 'user-1');

    expect(page.items[0]).toMatchObject({
      id: 'cad-1',
      hasOperationalHistory: false,
      canDelete: true,
      canArchive: true,
    });
    expect(page.items[1]).toMatchObject({
      id: 'cad-2',
      hasOperationalHistory: true,
      canDelete: false,
      canArchive: true,
    });
  });
});
