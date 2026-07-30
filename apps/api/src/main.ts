import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Render injects PORT; fall back to 3001 so it doesn't collide with Vite on 5173.
  const port = Number(process.env.PORT ?? config.get('API_PORT', 3001));
  const frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');

  // Behind Render's proxy, trust the first hop so req.ip is the real client
  // rather than the proxy — without this, ThrottlerGuard buckets every request
  // under one IP and per-IP rate limiting silently does nothing.
  app.set('trust proxy', 1);

  app.use(helmet());

  app.enableCors({
    origin: config.get('CORS_ORIGINS', frontendUrl).split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Prime Developers API')
      .setDescription('Public site content, news, and lead capture')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
