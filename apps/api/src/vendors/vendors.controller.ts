import {
  Body,
  Controller,
  Get,
  Param,
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
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { ListVendorsQueryDto } from "./dto/list-vendors-query.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { VendorsService } from "./vendors.service";

@Controller("vendors")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get("status")
  getStatus() {
    return this.vendorsService.getFoundationStatus();
  }

  @Get()
  list(@Query() query: ListVendorsQueryDto) {
    return this.vendorsService.list(query);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.vendorsService.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreateVendorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.vendorsService.create(dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.vendorsService.update(id, dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
