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

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AssignmentsService } from "./assignments.service";
import { CloseAssignmentDto } from "./dto/close-assignment.dto";
import { CreateChainAreaManagerAssignmentDto } from "./dto/create-chain-area-manager-assignment.dto";
import { CreatePickerBranchAssignmentDto } from "./dto/create-picker-branch-assignment.dto";
import { CreateVendorChampAssignmentDto } from "./dto/create-vendor-champ-assignment.dto";
import { ListAssignmentsQueryDto } from "./dto/list-assignments-query.dto";

@Controller("assignments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AssignmentsController {
  constructor(
    @Inject(AssignmentsService)
    private readonly assignmentsService: AssignmentsService
  ) {}

  @Get("status")
  getStatus() {
    return this.assignmentsService.getFoundationStatus();
  }

  @Get("picker/:pickerId/current")
  getPickerCurrent(@Param("pickerId", ParseUUIDPipe) pickerId: string) {
    return this.assignmentsService.getPickerCurrentContext(pickerId);
  }

  @Get("vendor/:vendorId/champ/current")
  getVendorChampCurrent(@Param("vendorId", ParseUUIDPipe) vendorId: string) {
    return this.assignmentsService.getVendorCurrentChamp(vendorId);
  }

  @Get("chain/:chainId/area-manager/current")
  getChainAreaManagerCurrent(@Param("chainId", ParseUUIDPipe) chainId: string) {
    return this.assignmentsService.getChainCurrentAreaManager(chainId);
  }

  @Get("pickers")
  listPickerBranchAssignments(@Query() query: ListAssignmentsQueryDto) {
    return this.assignmentsService.listPickerBranchAssignments(query);
  }

  @Get("vendor-champs")
  listVendorChampAssignments(@Query() query: ListAssignmentsQueryDto) {
    return this.assignmentsService.listVendorChampAssignments(query);
  }

  @Get("chain-area-managers")
  listChainAreaManagerAssignments(@Query() query: ListAssignmentsQueryDto) {
    return this.assignmentsService.listChainAreaManagerAssignments(query);
  }

  @Post("picker-branch")
  createPickerBranchAssignment(
    @Body() dto: CreatePickerBranchAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.assignmentsService.createPickerBranchAssignment(dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("vendor-champ")
  createVendorChampAssignment(
    @Body() dto: CreateVendorChampAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.assignmentsService.createVendorChampAssignment(dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("chain-area-manager")
  createChainAreaManagerAssignment(
    @Body() dto: CreateChainAreaManagerAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.assignmentsService.createChainAreaManagerAssignment(dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Patch("picker-branch/:id/close")
  closePickerBranchAssignment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CloseAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.assignmentsService.closePickerBranchAssignment(id, dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Patch("vendor-champ/:id/close")
  closeVendorChampAssignment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CloseAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.assignmentsService.closeVendorChampAssignment(id, dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Patch("chain-area-manager/:id/close")
  closeChainAreaManagerAssignment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CloseAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.assignmentsService.closeChainAreaManagerAssignment(id, dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
