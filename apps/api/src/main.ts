import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase payload limit for base64 images (logos, header banners)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Enable CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : true; // reflect request origin if not specified

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Security (disable CSP so Swagger UI can load CSS/JS styles/scripts)
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // Compression
  app.use(compression());

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('BillNova API')
    .setDescription('Billing ERP API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `🚀 BillNova API running at http://localhost:${process.env.PORT ?? 3000}`,
  );

  console.log(
    `📖 Swagger Docs: http://localhost:${process.env.PORT ?? 3000}/docs`,
  );
}

bootstrap();
