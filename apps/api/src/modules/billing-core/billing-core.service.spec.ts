import { BillingCoreService } from './billing-core.service';

describe('BillingCoreService', () => {
  it('exposes the adapter-ready capability flags', () => {
    const service = new BillingCoreService();

    expect(service.getCapabilities()).toEqual({
      providerConfigured: false,
      boletoGenerationEnabled: false,
      readyForAdapters: true,
    });
  });
});
