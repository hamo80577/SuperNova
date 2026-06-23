import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { AccessPolicyService } from "../access-control/access-policy.service";
import { PermissionKeys, type PermissionKey } from "../access-control/permissions";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CancelRequestDto } from "./dto/cancel-request.dto";
import { CreateAnnualLeaveRequestDto } from "./dto/create-annual-leave-request.dto";
import { CreateNewHireRequestDto } from "./dto/create-new-hire-request.dto";
import { CreateOffboardingRequestDto } from "./dto/create-offboarding-request.dto";
import { CreateRequestDto } from "./dto/create-request.dto";
import { CreateTransferRequestDto } from "./dto/create-transfer-request.dto";
import { FinalizeNewHireDto } from "./dto/finalize-new-hire.dto";
import { FinalizeOffboardingDto } from "./dto/finalize-offboarding.dto";
import { ListRequestsQueryDto } from "./dto/list-requests-query.dto";
import { LookupNewHireCandidateDto } from "./dto/lookup-new-hire-candidate.dto";
import { SearchOffboardingPickersDto } from "./dto/search-offboarding-pickers.dto";
import { RequestsService } from "./requests.service";

@Controller("requests")
export class RequestsController {
  constructor(
    @Inject(RequestsService)
    private readonly requestsService: RequestsService,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
  ) {}

  @Get("status")
  getStatus() {
    return this.requestsService.getFoundationStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(
    @Query() query: ListRequestsQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REQUESTS_VIEW);

    return this.requestsService.list(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my/submitted")
  listSubmitted(
    @Query() query: ListRequestsQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REQUESTS_VIEW);

    return this.requestsService.listSubmitted(query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PICKER, UserRole.CHAMP)
  @Get("annual-leave/availability")
  getAnnualLeaveAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.requestsService.getAnnualLeaveAvailability({
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CHAMP, UserRole.AREA_MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get("offboarding/pickers")
  searchOffboardingPickers(
    @Query() query: SearchOffboardingPickersDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      this.permissionForOffboardingTargetRole(query.targetRole)
    );

    return this.requestsService.searchOffboardingPickers(query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CHAMP, UserRole.AREA_MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get("offboarding/eligible-users")
  searchOffboardingEligibleUsers(
    @Query() query: SearchOffboardingPickersDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      this.permissionForOffboardingTargetRole(query.targetRole)
    );

    return this.requestsService.searchOffboardingEligibleUsers(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REQUESTS_VIEW);

    return this.requestsService.getById(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CHAMP, UserRole.AREA_MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post("new-hire/lookup-candidate")
  lookupNewHireCandidate(
    @Body() dto: LookupNewHireCandidateDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.accessPolicy.assertCan(
      user,
      this.permissionForNewHireTargetRole(dto.targetRole)
    );

    return this.requestsService.lookupNewHireCandidate(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("new-hire")
  createNewHire(
    @Body() dto: CreateNewHireRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      this.permissionForNewHireTargetRole(dto.targetRole)
    );

    return this.requestsService.createNewHire(dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("offboarding")
  createOffboarding(
    @Body() dto: CreateOffboardingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      this.permissionForOffboardingTargetRole(dto.targetRole)
    );

    return this.requestsService.createOffboarding(dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("transfer")
  createTransfer(
    @Body() dto: CreateTransferRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER
    );

    return this.requestsService.createTransfer(dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PICKER, UserRole.CHAMP)
  @Post("annual-leave/preview")
  previewAnnualLeave(
    @Body() dto: CreateAnnualLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.requestsService.previewAnnualLeave(dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PICKER, UserRole.CHAMP)
  @Post("annual-leave")
  createAnnualLeave(
    @Body() dto: CreateAnnualLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.requestsService.createAnnualLeaveRequest(dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post(":id/finalize-new-hire")
  finalizeNewHire(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: FinalizeNewHireDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
    );

    return this.requestsService.finalizeNewHire(id, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post(":id/finalize-offboarding")
  finalizeOffboarding(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: FinalizeOffboardingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(
      user,
      PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE
    );

    return this.requestsService.finalizeOffboarding(id, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.requestsService.create(dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/submit")
  submit(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REQUESTS_VIEW);

    return this.requestsService.submit(id, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/cancel")
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    this.accessPolicy.assertCan(user, PermissionKeys.REQUESTS_CANCEL);

    return this.requestsService.cancel(id, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  private permissionForNewHireTargetRole(targetRole?: UserRole): PermissionKey {
    switch (targetRole ?? UserRole.PICKER) {
      case UserRole.PICKER:
        return PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER;
      case UserRole.CHAMP:
        return PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP;
      case UserRole.AREA_MANAGER:
        return PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER;
      default:
        throw new BadRequestException(
          "targetRole must be PICKER, CHAMP, or AREA_MANAGER."
        );
    }
  }

  private permissionForOffboardingTargetRole(
    targetRole?: UserRole
  ): PermissionKey {
    switch (targetRole ?? UserRole.PICKER) {
      case UserRole.PICKER:
        return PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER;
      case UserRole.CHAMP:
        return PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP;
      case UserRole.AREA_MANAGER:
        return PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER;
      default:
        throw new BadRequestException(
          "targetRole must be PICKER, CHAMP, or AREA_MANAGER."
        );
    }
  }
}
