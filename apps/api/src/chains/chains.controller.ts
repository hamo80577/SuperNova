import {
  Body,
  Controller,
  Get,
  Inject,
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
import { ChainsService } from "./chains.service";
import { CreateChainDto } from "./dto/create-chain.dto";
import { ListChainsQueryDto } from "./dto/list-chains-query.dto";
import { UpdateChainDto } from "./dto/update-chain.dto";

@Controller("chains")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ChainsController {
  constructor(@Inject(ChainsService) private readonly chainsService: ChainsService) {}

  @Get("status")
  getStatus() {
    return this.chainsService.getFoundationStatus();
  }

  @Get()
  list(@Query() query: ListChainsQueryDto) {
    return this.chainsService.list(query);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.chainsService.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreateChainDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.chainsService.create(dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateChainDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.chainsService.update(id, dto, {
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
