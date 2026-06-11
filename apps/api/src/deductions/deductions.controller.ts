import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { AccessPolicyService } from "../access-control/access-policy.service";
import {
  PermissionKeys,
  type PermissionKey
} from "../access-control/permissions";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { DeductionPolicyService } from "./deduction-policy.service";
import { DeductionsService } from "./deductions.service";
import {
  ListDeductionsQueryDto,
  SearchDeductionTargetsDto
} from "./dto/list-deductions-query.dto";
import {
  CreateDeductionRequestDto,
  PreviewDeductionDto
} from "./dto/preview-deduction.dto";
import {
  CreateDeductionActionDto,
  UpdateDeductionActionDto
} from "./dto/manage-policy.dto";

@Controller("deductions")
@UseGuards(JwtAuthGuard)
export class DeductionsController {
  constructor(
    @Inject(DeductionsService)
    private readonly deductionsService: DeductionsService,
    @Inject(DeductionPolicyService)
    private readonly policyService: DeductionPolicyService,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
  ) {}

  @Get("policy/active")
  getActivePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Query("includeInactive") includeInactive?: string
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.DEDUCTIONS_VIEW);

    const includeInactiveActions =
      includeInactive === "true" &&
      this.accessPolicy.can(user, PermissionKeys.DEDUCTIONS_POLICY_MANAGE);

    return this.policyService.getActivePolicy({ includeInactiveActions });
  }

  @Post("policy/actions")
  createPolicyAction(
    @Body() dto: CreateDeductionActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.DEDUCTIONS_POLICY_MANAGE);

    return this.policyService.createAction(dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Patch("policy/actions/:id")
  updatePolicyAction(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeductionActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.DEDUCTIONS_POLICY_MANAGE);

    return this.policyService.updateAction(id, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Get("targets/search")
  searchTargets(
    @Query() query: SearchDeductionTargetsDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      this.permissionForTargetRole(query.role)
    );

    return this.deductionsService.searchTargets(
      user,
      this.deductionsService.normalizeTargetRole(query.role),
      query.q
    );
  }

  @Post("preview")
  preview(
    @Body() dto: PreviewDeductionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      this.permissionForTargetRole(dto.targetRole)
    );

    return this.deductionsService.preview(dto, user);
  }

  @Post("requests")
  createDeductionRequest(
    @Body() dto: CreateDeductionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      this.permissionForTargetRole(dto.targetRole)
    );

    return this.deductionsService.createDeductionRequest(dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Get()
  list(
    @Query() query: ListDeductionsQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.DEDUCTIONS_VIEW);

    return this.deductionsService.list(query, user);
  }

  @Get(":id")
  getById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.DEDUCTIONS_VIEW);

    return this.deductionsService.getById(id, user);
  }

  private permissionForTargetRole(targetRole?: UserRole): PermissionKey {
    if ((targetRole ?? UserRole.PICKER) === UserRole.CHAMP) {
      return PermissionKeys.REQUESTS_CREATE_DEDUCTION_CHAMP;
    }

    return PermissionKeys.REQUESTS_CREATE_DEDUCTION_PICKER;
  }
}
