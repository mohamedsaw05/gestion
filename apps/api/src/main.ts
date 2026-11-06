// Doit être le tout premier import : plusieurs modules lisent process.env au
// moment de leur évaluation (ex: CommonModule configure JwtModule avec
// process.env.JWT_ACCESS_SECRET dans le corps du décorateur @Module), donc les
// variables d'environnement doivent être chargées avant que ces modules soient
// importés, pas seulement avant bootstrap().
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // Adapter Express explicite : évite un souci de détection automatique du
  // driver HTTP observé avec cette version de Nest en mode ESM ("type": "module").
  const app = await NestFactory.create(AppModule, new ExpressAdapter());

  app.use(helmet());
  const rawCors = process.env.API_CORS_ORIGIN;
  const corsOrigins = rawCors
    ? rawCors.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:5180', 'http://localhost:5174', 'http://localhost:5173'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  // Validation stricte en entrée (cf docs/architecture/07-securite.md §8) :
  // whitelist supprime silencieusement les champs non déclarés dans les DTO,
  // forbidNonWhitelisted rejette explicitement la requête si elle en contient.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : (process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API démarrée sur http://0.0.0.0:${port} (PORT=${process.env.PORT || 'non défini'}, API_PORT=${process.env.API_PORT || 'non défini'})`);
}
await bootstrap();
