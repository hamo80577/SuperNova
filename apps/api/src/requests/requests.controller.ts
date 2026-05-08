import {
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

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CancelRequestDto } from "./dto/cancel-request.dto";
import { CreateRequestDto } from "./dto/create-request.dto";
import { ListRequestsQueryDto } from "./dto/list-requests-query.dto";
import { RequestsService } from "./requests.service";

@Controller("requests")
export class RequestsController {
  constructor(
    @Inject(RequestsService)
    private readonly requestsService: RequestsService
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
    return this.requestsService.list(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my/submitted")
  listSubmitted(
    @Query() query: ListRequestsQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.requestsService.listSubmitted(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.requestsService.getById(id, user);
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
    return this.requestsService.cancel(id, dto, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
