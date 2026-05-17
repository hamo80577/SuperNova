import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";

import { AppModule } from "./app.module";
import {
  createRequestLoggerMiddleware,
  isRequestLoggerEnabled
} from "./common/middleware/request-logger.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const webOrigin = configService.get<string>("auth.webOrigin");

  app.setGlobalPrefix("api");
  if (
    isRequestLoggerEnabled({
      flag: configService.get<string>("api.requestLogger"),
      nodeEnv: process.env.NODE_ENV
    })
  ) {
    app.use(createRequestLoggerMiddleware());
  }

  app.use(cookieParser());
  app.enableCors({
    origin: webOrigin,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const port = configService.get<number>("api.port") ?? 4000;
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
