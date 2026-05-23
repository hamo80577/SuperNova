import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AccessControlModule } from "../access-control/access-control.module";
import { AuditModule } from "../audit/audit.module";
import { HrSyncModule } from "../hr-sync/hr-sync.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { RequestApprovalRoutingService } from "./request-approval-routing.service";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
import { NewHireCandidateService } from "./workflows/new-hire-candidate.service";
import { NewHireFinalizationService } from "./workflows/new-hire-finalization.service";
import { NewHireRequestCreationService } from "./workflows/new-hire-request-creation.service";
import { NewHireApprovalService } from "./workflows/new-hire-approval.service";
import { NewHireWorkflowService } from "./workflows/new-hire-workflow.service";
import { OffboardingApprovalService } from "./workflows/offboarding-approval.service";
import { OffboardingFinalizationService } from "./workflows/offboarding-finalization.service";
import { OffboardingRequestCreationService } from "./workflows/offboarding-request-creation.service";
import { OffboardingSearchService } from "./workflows/offboarding-search.service";
import { OffboardingTargetService } from "./workflows/offboarding-target.service";
import { OffboardingWorkflowService } from "./workflows/offboarding-workflow.service";
import { TransferWorkflowService } from "./workflows/transfer-workflow.service";

@Module({
  controllers: [RequestsController],
  imports: [
    AccessControlModule,
    AuditModule,
    HrSyncModule,
    JwtModule.register({}),
    NotificationsModule,
    UsersModule
  ],
  providers: [
    RequestApprovalRoutingService,
    RequestsService,
    NewHireApprovalService,
    NewHireCandidateService,
    NewHireFinalizationService,
    NewHireRequestCreationService,
    NewHireWorkflowService,
    OffboardingApprovalService,
    OffboardingFinalizationService,
    OffboardingRequestCreationService,
    OffboardingSearchService,
    OffboardingTargetService,
    OffboardingWorkflowService,
    TransferWorkflowService
  ],
  exports: [RequestsService]
})
export class RequestsModule {}
