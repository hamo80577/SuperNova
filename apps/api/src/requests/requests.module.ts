import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { RequestApprovalRoutingService } from "./request-approval-routing.service";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
import { NewHireWorkflowService } from "./workflows/new-hire-workflow.service";
import { OffboardingWorkflowService } from "./workflows/offboarding-workflow.service";
import { TransferWorkflowService } from "./workflows/transfer-workflow.service";

@Module({
  controllers: [RequestsController],
  imports: [AuditModule, JwtModule.register({}), NotificationsModule, UsersModule],
  providers: [
    RequestApprovalRoutingService,
    RequestsService,
    NewHireWorkflowService,
    OffboardingWorkflowService,
    TransferWorkflowService
  ],
  exports: [RequestsService]
})
export class RequestsModule {}
