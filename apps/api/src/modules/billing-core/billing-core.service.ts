import { Injectable } from '@nestjs/common';

@Injectable()
export class BillingCoreService {
  getCapabilities() {
    return {
      providerConfigured: false,
      boletoGenerationEnabled: false,
      readyForAdapters: true,
    };
  }
}
