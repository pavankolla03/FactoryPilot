import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  if ((process.env.AUTH_MODE || 'xsuaa') === 'mock' && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_MODE=mock is not allowed in production');
  }

  const app = await NestFactory.create(AppModule, { cors: false });

  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  app.getHttpAdapter().get('/health', (_req: unknown, res: { status: (n: number) => { json: (x: unknown) => void } }) => {
    res.status(200).json({ status: 'ok' });
  });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}

bootstrap();
