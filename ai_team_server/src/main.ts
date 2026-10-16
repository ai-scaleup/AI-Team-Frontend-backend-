import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

import { AgencyWhiteLabelService } from './agency/agency-white-label.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const whiteLabel = app.get(AgencyWhiteLabelService);

  app.enableCors({
    // CORS_ORIGINS accepts a comma-separated list of frontend URLs. An empty
    // value keeps the test deployment open to browser clients on any origin.
    // An agency's own address (AgencyDomain) is allowed as well, since its
    // customers use the app from there.
    origin:
      configuredOrigins.length > 0
        ? (
            origin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void,
          ) => {
            if (
              !origin ||
              configuredOrigins.includes(origin.replace(/\/$/, ''))
            ) {
              callback(null, true);
              return;
            }
            whiteLabel
              .isAgencyOrigin(origin)
              .then((allowed) => callback(null, allowed))
              .catch(() => callback(null, false));
          }
        : true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  setupSwagger(app);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 8000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
