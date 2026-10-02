import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    // CORS_ORIGINS accepts a comma-separated list of frontend URLs. An empty
    // value keeps the test deployment open to browser clients on any origin.
    origin: configuredOrigins.length > 0 ? configuredOrigins : true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  setupSwagger(app);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 8000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
