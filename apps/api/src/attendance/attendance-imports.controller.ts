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
import { AttendanceImportQueueService } from "./attendance-import-queue.service";
import { AttendanceImportService } from "./attendance-import.service";

type UploadedAttendanceFile = Readonly<{
  originalname?: string;
  path?: string;
  size?: number;
}>;

@Controller("attendance/imports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AttendanceImportsController {
  constructor(
    @Inject(AttendanceImportQueueService)
    private readonly attendanceImportQueueService: AttendanceImportQueueService,
    @Inject(AttendanceImportService)
    private readonly attendanceImportService: AttendanceImportService,
    @Inject(ImportFileStorageService)
    private readonly fileStorage: ImportFileStorageService
  ) {}

  @Post("preview")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor("file"))
  async previewImport(
    @UploadedFile() file: UploadedAttendanceFile | undefined,
    @Body("uploadDate") uploadDate: string | undefined,
    @Body("importMode") importMode: string | undefined,
    @Body("periodMonth") periodMonth: string | undefined,
    @Body("duplicateResolutionRowNumbers")
    duplicateResolutionRowNumbers: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    if (!file?.path || !file.size) {
      if (file?.path) {
        await this.fileStorage.remove(file.path);
      }
      throw new BadRequestException("Attendance file is required.");
    }

    let parsedDuplicateRows: number[] | undefined;
    try {
      parsedDuplicateRows = parseDuplicateResolutionRowNumbers(
        duplicateResolutionRowNumbers
      );
    } catch (error) {
      await this.fileStorage.remove(file.path);
      throw error;
    }

    return this.attendanceImportQueueService.enqueue(file, {
      actor: user,
      duplicateResolutionRowNumbers: parsedDuplicateRows,
      fileName: file.originalname ?? "attendance-import.xlsx",
      importMode,
      periodMonth,
      uploadDate,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Get(":batchId/status")
  getImportStatus(@Param("batchId", ParseUUIDPipe) batchId: string) {
    return this.attendanceImportQueueService.getStatus(batchId);
  }

  @Post(":batchId/confirm")
  confirmImport(
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attendanceImportService.confirmImport(batchId, {
      actor: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}

function parseDuplicateResolutionRowNumbers(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BadRequestException(
      "duplicateResolutionRowNumbers must be a JSON array of row numbers."
    );
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => Number.isInteger(item) && item > 0)
  ) {
    throw new BadRequestException(
      "duplicateResolutionRowNumbers must be a JSON array of row numbers."
    );
  }

  return Array.from(new Set(parsed));
}
