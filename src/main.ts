import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configuração CORS - usa CORS_ORIGINS do ambiente ou fallback para desenvolvimento
  const defaultOrigins = [
    'http://localhost:3002',
    'http://localhost:3001',
    'http://promata-frontend.s3-website.us-east-2.amazonaws.com',
    'https://www.promata.com.br',
    'https://promata.com.br',
  ];

  // Adiciona FRONTEND_URL (sem barra final) caso esteja configurado
  if (process.env.FRONTEND_URL) {
    const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
    if (!defaultOrigins.includes(frontendUrl)) {
      defaultOrigins.push(frontendUrl);
    }
  }

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim().replace(/\/$/, ''))
    : defaultOrigins;

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Pró-Mata Api')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .setVersion('0.1')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch(console.error);