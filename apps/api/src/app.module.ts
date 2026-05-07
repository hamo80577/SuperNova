import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { ApprovalsModule } from "./approvals/approvals.module";
import { AssignmentsModule } from "./assignments/assignments.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import configuration from "./config/configuration";
import { validateEnvironment } from "./config/env.validation";
import { ChainsModule } from "./chains/chains.module";
import { HealthModule } from "./health/health.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RequestsModule } from "./requests/requests.module";
import { UsersModule } from "./users/users.module";
import { VendorsModule } from "./vendors/vendors.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validate: validateEnvironment
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ChainsModule,
    VendorsModule,
    AssignmentsModule,
    RequestsModule,
    ApprovalsModule,
    NotificationsModule,
    AuditModule
  ]
})
export class AppModule {}
