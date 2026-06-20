import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { ApprovalsModule } from "./approvals/approvals.module";
import { AssignmentsModule } from "./assignments/assignments.module";
import { AdminModule } from "./admin/admin.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { AccessControlModule } from "./access-control/access-control.module";
import configuration from "./config/configuration";
import { validateEnvironment } from "./config/env.validation";
import { ChainsModule } from "./chains/chains.module";
import { DeductionsModule } from "./deductions/deductions.module";
import { DashboardCacheEventsListener } from "./dashboard-cache/dashboard-cache-events.listener";
import { DashboardCacheModule } from "./dashboard-cache/dashboard-cache.module";
import { HealthModule } from "./health/health.module";
import { HrSyncModule } from "./hr-sync/hr-sync.module";
import { ImportJobsModule } from "./import-jobs/import-jobs.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OrdersKpisModule } from "./orders-kpis/orders-kpis.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { RequestsModule } from "./requests/requests.module";
import { UsersModule } from "./users/users.module";
import { VendorsModule } from "./vendors/vendors.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validate: validateEnvironment
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    ImportJobsModule,
    DashboardCacheModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ChainsModule,
    VendorsModule,
    AssignmentsModule,
    RequestsModule,
    ApprovalsModule,
    DeductionsModule,
    AccessControlModule,
    HrSyncModule,
    AttendanceModule,
    OrdersKpisModule,
    NotificationsModule,
    AuditModule,
    AdminModule,
    ReportsModule,
    WorkspacesModule
  ],
  providers: [DashboardCacheEventsListener]
})
export class AppModule {}
