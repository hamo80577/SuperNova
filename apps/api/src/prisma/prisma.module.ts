import { Global, Module } from "@nestjs/common";

import {
  getPrismaServiceSingleton,
  PrismaService
} from "./prisma.service";

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: getPrismaServiceSingleton
    }
  ],
  exports: [PrismaService]
})
export class PrismaModule {}
