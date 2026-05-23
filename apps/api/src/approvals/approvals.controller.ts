import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";

import { PermissionGuard } from "../access-control/permission.guard";
import { PermissionKeys } from "../access-control/permissions";
import { RequirePermission } from "../access-control/require-permission.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { ApprovalsService } from "./approvals.service";
import { ApprovalDecisionDto } from "./dto/approval-decision.dto";

@Controller("approvals")
export class ApprovalsController {
  constructor(
    @Inject(ApprovalsService)
    private readonly approvalsService: ApprovalsService
  ) {}

  @Get("status")
  getStatus() {
    return this.approvalsService.getFoundationStatus();
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PermissionKeys.APPROVALS_VIEW_PENDING)
  @Get("pending")
  listPending(@CurrentUser() user: AuthenticatedUser) {
    return this.approvalsService.listPending(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":approvalId/approve")
  approve(
    @Param("approvalId", ParseUUIDPipe) approvalId: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.approvalsService.approve(approvalId, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(":approvalId/reject")
  reject(
    @Param("approvalId", ParseUUIDPipe) approvalId: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.approvalsService.reject(approvalId, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
