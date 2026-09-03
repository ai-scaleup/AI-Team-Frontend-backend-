import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('AI Team Backend API')
    .setDescription(
      [
        'Interactive API documentation for the AI Team backend.',
        'Every application endpoint requires a credential. The development token from the backend .env (DEV_API_TOKEN) is checked first and takes priority — send it either as the x-dev-token header or as Authorization: Bearer <token>. Otherwise a Clerk JWT in Authorization: Bearer authenticates the request. Signed external webhooks and the n8n workflow routes are the exception.',
        'Use the Authorize button and fill in whichever one you have before sending requests: paste the development token into either field, or a Clerk JWT into the bearer field.',
      ].join(' '),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT or DEV_API_TOKEN',
        description:
          'Authorization: Bearer <token>. Accepts either the development token from the backend .env (DEV_API_TOKEN) — which is matched first — or a Clerk JWT. Swagger adds the Bearer prefix automatically.',
      },
      'clerk-bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-dev-token',
        description:
          'Development token from the backend .env (DEV_API_TOKEN), sent as the x-dev-token header. Checked before the Clerk JWT: a correct token authorizes the request on its own.',
      },
      'dev-token',
    )
    // Two independent requirements: satisfying either one authorizes the call.
    .addSecurityRequirements('clerk-bearer')
    .addSecurityRequirements('dev-token')
    .addTag('health', 'Application health and root endpoints')
    .addTag('users', 'User management, sync, and alerts')
    .addTag('conversations', 'Conversation and message history')
    .addTag('user-preferences', 'Per-user, per-agent personalization settings')
    .addTag('admin', 'Admin agent, group, assignment, and user management')
    .addTag('admin-dashboard', 'Admin dashboard user operations')
    .addTag('memberships', 'Membership templates and assignments')
    .addTag('webhooks', 'External webhook receivers')
    .addTag('sara-ai', 'Sara AI chat logs and analytics')
    .addTag('jennifer', 'Jennifer chat sessions and logs')
    .addTag('chiara', 'Chiara chat logs and leads')
    .addTag(
      'chiara-whatsapp',
      'Chiara WhatsApp leads — authenticated by the development token (DEV_API_TOKEN) alone, no Clerk JWT; one session may hold many leads',
    )
    .addTag('tags', 'Tag field management and tag generation')
    .addTag('token-usage', 'Per-user and per-agent token usage limits')
    .addTag(
      'token-alert-rules',
      'Announcer-bar alert thresholds for conversation and monthly token usage',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const darkThemeCss = `
    body { background: #0d0d0d; }
    .swagger-ui { background: #0d0d0d; }
    .swagger-ui .topbar { background: #000; border-bottom: 1px solid #222; }
    .swagger-ui .info .title, .swagger-ui .info p, .swagger-ui .info li,
    .swagger-ui .info a, .swagger-ui label, .swagger-ui .tab li,
    .swagger-ui .opblock-tag, .swagger-ui .opblock-tag small { color: #e0e0e0; }
    .swagger-ui .scheme-container { background: #111; box-shadow: none; padding: 16px; }
    .swagger-ui section.models { background: #111; border: 1px solid #222; }
    .swagger-ui section.models h4 { color: #e0e0e0; }
    .swagger-ui .model-title, .swagger-ui .model, .swagger-ui .prop-type,
    .swagger-ui table thead tr th, .swagger-ui table thead tr td { color: #ccc; }
    .swagger-ui .opblock { background: #111; border: 1px solid #222; border-radius: 6px; margin-bottom: 6px; }
    .swagger-ui .opblock .opblock-summary { border-color: #222; }
    .swagger-ui .opblock .opblock-summary-description { color: #aaa; }
    .swagger-ui .opblock.opblock-get { border-color: #1a3a5c; background: #0a1e2e; }
    .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #1a3a5c; background: #0d2440; }
    .swagger-ui .opblock.opblock-post { border-color: #1a4a2a; background: #0a2010; }
    .swagger-ui .opblock.opblock-post .opblock-summary { border-color: #1a4a2a; background: #0d2a14; }
    .swagger-ui .opblock.opblock-delete { border-color: #4a1a1a; background: #200a0a; }
    .swagger-ui .opblock.opblock-delete .opblock-summary { border-color: #4a1a1a; background: #2a0d0d; }
    .swagger-ui .opblock.opblock-put { border-color: #4a3a0a; background: #201500; }
    .swagger-ui .opblock.opblock-put .opblock-summary { border-color: #4a3a0a; background: #2a1d00; }
    .swagger-ui .opblock.opblock-patch { border-color: #3a2a0a; background: #181000; }
    .swagger-ui .opblock-summary-path,
    .swagger-ui .opblock-summary-path__deprecated,
    .swagger-ui .opblock-summary-path span,
    .swagger-ui .opblock-summary-path a { color: #ffffff !important; opacity: 1 !important; }
    .swagger-ui .opblock-summary-description { color: #cccccc !important; opacity: 1 !important; }
    .swagger-ui .opblock-body, .swagger-ui .opblock-description-wrapper p,
    .swagger-ui .response-col_status, .swagger-ui .response-col_links,
    .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5,
    .swagger-ui .parameter__name, .swagger-ui .parameter__type,
    .swagger-ui .parameter__deprecated, .swagger-ui .parameter__in,
    .swagger-ui table.model tr.description td,
    .swagger-ui .prop-format { color: #ccc; }
    .swagger-ui textarea, .swagger-ui input[type=text], .swagger-ui input[type=email],
    .swagger-ui input[type=file], .swagger-ui input[type=password], .swagger-ui select {
      background: #1a1a1a; color: #e0e0e0; border: 1px solid #333;
    }
    .swagger-ui .btn { background: #1a1a1a; color: #e0e0e0; border-color: #444; }
    .swagger-ui .btn.authorize { background: #0a2a0a; color: #4caf50; border-color: #4caf50; }
    .swagger-ui .btn.execute { background: #0a2040; color: #5b9bd5; border-color: #5b9bd5; }
    .swagger-ui .highlight-code, .swagger-ui .microlight { background: #1a1a1a !important; }
    .swagger-ui .model-box { background: #161616; }
    .swagger-ui .expand-methods svg, .swagger-ui .expand-operation svg { fill: #aaa; }
    .swagger-ui svg.arrow { fill: #aaa; }
    .swagger-ui .dialog-ux .modal-ux { background: #111; border: 1px solid #333; }
    .swagger-ui .dialog-ux .modal-ux-header { background: #0d0d0d; border-bottom: 1px solid #333; }
    .swagger-ui .dialog-ux .modal-ux-header h3 { color: #e0e0e0; }
    .swagger-ui .dialog-ux .modal-ux-content p, .swagger-ui .dialog-ux .modal-ux-content h4 { color: #ccc; }
    .swagger-ui .auth-container { background: #111; }
    .swagger-ui .auth-container .wrapper { background: #111; }
  `;

  const swaggerOptions = {
    customSiteTitle: 'AI Team API Docs',
    customCss: darkThemeCss,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  };

  SwaggerModule.setup('api/docs', app, document, swaggerOptions);
  SwaggerModule.setup('api', app, document, swaggerOptions);
}
