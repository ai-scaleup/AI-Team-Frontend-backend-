import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('AI Team Backend API')
    .setDescription(
      [
        'Interactive API documentation for the AI Team backend.',
        'Use the Authorize button for endpoints that are protected by Clerk bearer tokens.',
      ].join(' '),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Clerk JWT access token',
      },
      'clerk-bearer',
    )
    .addTag('health', 'Application health and root endpoints')
    .addTag('users', 'User management, sync, and alerts')
    .addTag('conversations', 'Conversation and message history')
    .addTag('user-preferences', 'Per-user, per-agent personalization settings')
    .addTag('admin', 'Admin agent, group, assignment, and user management')
    .addTag('admin-dashboard', 'Admin dashboard membership and user operations')
    .addTag('webhooks', 'External webhook receivers')
    .addTag('sara-ai', 'Sara AI chat logs and analytics')
    .addTag('jennifer', 'Jennifer chat sessions and logs')
    .addTag('chiara', 'Chiara chat logs and leads')
    .addTag('tags', 'Tag field management and tag generation')
    .addTag('token-usage', 'Per-user and per-agent token usage limits')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'AI Team API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'AI Team API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
