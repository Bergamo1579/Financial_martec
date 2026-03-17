import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  PEDAGOGICAL_SYNC_JOB,
  PEDAGOGICAL_SYNC_QUEUE,
} from '@financial-martec/contracts';
import { RedisService } from '@/common/redis/redis.service';
import { PedagogicalProjectionService } from '@/modules/integration/pedagogical/pedagogical.projection.service';

@Injectable()
export class SyncService {
  private readonly queue: Queue;

  constructor(
    redisService: RedisService,
    private readonly projection: PedagogicalProjectionService,
  ) {
    this.queue = new Queue(PEDAGOGICAL_SYNC_QUEUE, {
      connection: redisService.getClient(),
    });
  }

  async enqueuePedagogicalSync(triggeredByUserId: string) {
    const job = await this.queue.add(
      PEDAGOGICAL_SYNC_JOB,
      {
        triggeredByUserId,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  async executePedagogicalSync(triggeredByUserId?: string | null, mode = 'worker') {
    return this.projection.runFullSync(triggeredByUserId, mode);
  }
}
