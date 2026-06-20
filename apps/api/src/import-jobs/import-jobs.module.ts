import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";

import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";

import { EXCEL_IMPORT_QUEUE } from "./import-jobs.constants";
import { ImportFileStorageService } from "./import-file-storage.service";
import { redisConnectionFromUrl } from "./redis-connection";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnectionFromUrl(
          configService.get<string>("imports.redisUrl") ??
            "redis://localhost:6379"
        ),
        prefix: "supernova"
      })
    }),
    BullModule.registerQueue({ name: EXCEL_IMPORT_QUEUE }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const storagePath = resolve(
          configService.get<string>("imports.storagePath") ?? "var/imports"
        );
        mkdirSync(storagePath, { recursive: true });

        return {
          storage: diskStorage({
            destination: storagePath,
            filename: (_request, file, callback) => {
              callback(
                null,
                `${randomUUID()}${extname(file.originalname).toLowerCase()}`
              );
            }
          }),
          limits: {
            fileSize:
              configService.get<number>("imports.maxFileSizeBytes") ??
              100 * 1024 * 1024,
            files: 1
          }
        };
      }
    })
  ],
  providers: [ImportFileStorageService],
  exports: [BullModule, ImportFileStorageService, MulterModule]
})
export class ImportJobsModule {}
