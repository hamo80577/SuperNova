import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { WorkerAppModule } from "./worker-app.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  app.enableShutdownHooks();
  Logger.log("Excel import worker is ready.", "WorkerBootstrap");
}

void bootstrap();
