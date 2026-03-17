import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  @ApiOkResponse({ description: 'Aplicação viva' })
  live() {
    return {
      status: 'ok',
      service: 'financial-martec-api',
    };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Dependências prontas' })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.redis.getClient().ping();

    return {
      status: 'ready',
    };
  }
}
