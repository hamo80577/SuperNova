import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { OrdersKpisImportService } from "./orders-kpis-import.service";

type UploadedOrdersKpiFile = Readonly<{
  originalname?: string;
  buffer?: Buffer;
}>;

@Controller("orders-kpis/imports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class OrdersKpisImportsController {
  constructor(
    @Inject(OrdersKpisImportService)
    private readonly ordersKpisImportService: OrdersKpisImportService
  ) {}

  @Post("preview")
  @UseInterceptors(FileInterceptor("file"))
  previewImport(
    @UploadedFile() file: UploadedOrdersKpiFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("Orders KPI file is required.");
    }

    return this.ordersKpisImportService.previewImport(file.buffer, {
      actor: user,
      fileName: file.originalname ?? "orders-kpis-import.xlsx",
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
