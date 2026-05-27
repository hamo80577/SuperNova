import {
  BadRequestException,
  Body,
  Controller,
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
import { AttendanceImportService } from "./attendance-import.service";

type UploadedAttendanceFile = Readonly<{
  originalname?: string;
  buffer?: Buffer;
}>;

@Controller("attendance/imports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AttendanceImportsController {
  constructor(
    @Inject(AttendanceImportService)
    private readonly attendanceImportService: AttendanceImportService
  ) {}

  @Post("preview")
  @UseInterceptors(FileInterceptor("file"))
  previewImport(
    @UploadedFile() file: UploadedAttendanceFile | undefined,
    @Body("uploadDate") uploadDate: string | undefined,
    @Body("duplicateResolutionRowNumbers")
    duplicateResolutionRowNumbers: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("Attendance file is required.");
    }

    return this.attendanceImportService.previewImport(file.buffer, {
      actor: user,
      duplicateResolutionRowNumbers: parseDuplicateResolutionRowNumbers(
        duplicateResolutionRowNumbers
      ),
      fileName: file.originalname ?? "attendance-import.xlsx",
      uploadDate,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
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
