import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as unknown as {
  supernovaPrismaService?: PrismaService;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  async onModuleInit() {
    await this.$connect();
  }

  async onApplicationShutdown() {
    if (process.env.NODE_ENV === "production") {
      await this.$disconnect();
    }
  }
}

export function getPrismaServiceSingleton() {
  if (process.env.NODE_ENV === "production") {
    return new PrismaService();
  }

  prismaGlobal.supernovaPrismaService ??= new PrismaService();
  return prismaGlobal.supernovaPrismaService;
}
