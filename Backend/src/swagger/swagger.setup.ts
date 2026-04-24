import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as yaml from 'js-yaml';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Stellara Backend API')
    .setDescription(
      'REST API documentation for Stellara backend services.\n\n' +
        '## Versioning\n' +
        '- `/api/v1/*` — deprecated, sunset 2026-12-31\n' +
        '- `/api/v2/*` — current stable version\n\n' +
        '## Authentication\n' +
        'All protected endpoints require a Bearer JWT token.',
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT access token',
      },
      'bearer',
    )
    .addTag('Health', 'Service health and readiness checks')
    .addTag('Users', 'User management endpoints')
    .addTag('Versioning', 'API version status endpoints')
    .addTag('SLO', 'Service Level Objective metrics and error budgets')
    .addTag('Recovery', 'Automated recovery status and triggers')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    jsonDocumentUrl: '/api/docs-json',
  });

  const httpServer = app.getHttpAdapter().getInstance();
  httpServer.get('/api/docs-yaml', (_req: any, res: any) => {
    res.type('application/x-yaml');
    res.send(yaml.dump(document));
  });
}
