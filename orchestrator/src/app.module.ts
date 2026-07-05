import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminController } from './admin/admin.controller';
import { AuthModule } from './auth/auth.module';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { LogsController } from './chat/logs.controller';
import { DbService } from './common/db.service';
import { RedisService } from './common/redis.service';
import { LlmProviderFactory } from './llm/provider.factory';
import { McpService } from './mcp/mcp.service';
import { QuotaService } from './quota/quota.service';
import { RealtimeGateway } from './realtime/realtime.gateway';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ScheduleModule.forRoot(), AuthModule],
  controllers: [ChatController, AdminController, LogsController],
  providers: [
    DbService,
    RedisService,
    ChatService,
    LlmProviderFactory,
    McpService,
    QuotaService,
    RealtimeGateway,
  ],
})
export class AppModule {}
