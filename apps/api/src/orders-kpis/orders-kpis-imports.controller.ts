import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
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
import { ImportFileStorageService } from "../import-jobs/import-file-storage.service";
import { OrdersKpisImportQueueService } from "./orders-kpis-import-queue.service";
import { OrdersKpisImportService } from "./orders-kpis-import.service";
import type {
  OrdersKpiConfirmReplaceRequest,
  OrdersKpiRejectImportRequest
} from "./orders-kpis.types";

type UploadedOrdersKpiFile = Readonly<{
  originalname?: string;
  path?: string;
  size?: number;
}>;

@Controller("orders-kpis/imports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class OrdersKpisImportsController {
  constructor(
    @Inject(OrdersKpisImportQueueService)
    private readonly ordersKpisImportQueueService: OrdersKpisImportQueueService,
    @Inject(OrdersKpisImportService)
    private readonly ordersKpisImportService: OrdersKpisImportService,
    @Inject(ImportFileStorageService)
    private readonly fileStorage: ImportFileStorageService
  ) {}

  @Post("preview")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor("file"))
  async previewImport(
    @UploadedFile() file: UploadedOrdersKpiFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    if (!file?.path || !file.size) {
      if (file?.path) {
        await this.fileStorage.remove(file.path);
      }
      throw new BadRequestException("Orders KPI file is required.");
    }

    return this.ordersKpisImportQueueService.enqueue(file, {
      actor: user,
      fileName: file.originalname ?? "orders-kpis-import.xlsx",
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Get(":batchId/status")
  getImportStatus(@Param("batchId", ParseUUIDPipe) batchId: string) {
    return this.ordersKpisImportQueueService.getStatus(batchId);
  }

  @Post(":batchId/confirm-replace")
  confirmReplaceImport(
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @Body() body: OrdersKpiConfirmReplaceRequest | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersKpisImportService.confirmReplaceImport(batchId, {
      actor: user,
      acknowledgeReplaceDates: body?.acknowledgeReplaceDates === true,
      approveValidRowsOnly: body?.approveValidRowsOnly === true,
      acknowledgeSkippedErrorRows: body?.acknowledgeSkippedErrorRows === true,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post(":batchId/reject")
  rejectImport(
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @Body() body: OrdersKpiRejectImportRequest | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersKpisImportService.rejectImport(batchId, {
      actor: user,
      reason: body?.reason,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
