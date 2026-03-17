import { Module } from '@nestjs/common';
import { BillingCoreService } from './billing-core.service';

@Module({
  providers: [BillingCoreService],
  exports: [BillingCoreService],
})
export class BillingCoreModule {}
