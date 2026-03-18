import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  it('returns a paginated read-model response without exposing raw payload fields', async () => {
    const prisma = {
      pedagogicalCompanySnapshot: {
        findMany: jest.fn().mockResolvedValue([
          {
            sourceId: 'company-1',
            name: 'Empresa 1',
            legalName: 'Empresa 1 LTDA',
            taxId: '123',
            email: 'contato@empresa.test',
            phone: '1199999999',
            sourceUpdatedAt: new Date('2026-03-18T08:00:00.000Z'),
            lastSyncedAt: new Date('2026-03-18T08:10:00.000Z'),
            createdAt: new Date('2026-03-17T08:00:00.000Z'),
            updatedAt: new Date('2026-03-18T08:10:00.000Z'),
            data: { raw: true },
          },
        ]),
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn().mockResolvedValue({
          sourceId: 'company-1',
          name: 'Empresa 1',
          legalName: 'Empresa 1 LTDA',
          taxId: '123',
          email: 'contato@empresa.test',
          phone: '1199999999',
          sourceUpdatedAt: new Date('2026-03-18T08:00:00.000Z'),
          lastSyncedAt: new Date('2026-03-18T08:10:00.000Z'),
          createdAt: new Date('2026-03-17T08:00:00.000Z'),
          updatedAt: new Date('2026-03-18T08:10:00.000Z'),
          data: { raw: true },
        }),
      },
    };
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CompaniesService(prisma as never, audit as never);

    const page = await service.list(
      { page: 1, pageSize: 2, search: 'Empresa' },
      'user-1',
      'req-1',
    );
    const detail = await service.findOne('company-1', 'user-1', 'req-2');

    expect(page).toEqual({
      items: [
        expect.objectContaining({
          sourceId: 'company-1',
          name: 'Empresa 1',
        }),
      ],
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect(Object.prototype.hasOwnProperty.call(page.items[0], 'data')).toBe(false);
    expect(detail).toEqual(
      expect.objectContaining({
        sourceId: 'company-1',
        createdAt: '2026-03-17T08:00:00.000Z',
      }),
    );
    expect(audit.record).toHaveBeenCalledTimes(2);
  });
});
