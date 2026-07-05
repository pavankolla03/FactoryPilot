import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: RedisClientType;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL is required');
    }

    this.client = createClient({ url: redisUrl });
    this.client.connect();
  }

  get raw() {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
