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
import {
  ConfirmHistoricalAssignmentsDto,
  ListAttendanceImportIssuesQueryDto,
  ListAttendanceImportsQueryDto,
  PreviewHistoricalAssignmentsDto,
  UploadAttendanceImportDto
} from "./dto/attendance-operations.dto";
import {
  AttendanceOperationsService,
  type AttendanceUploadedFile
} from "./attendance-operations.service";

const FILE_INTERCEPTOR_OPTIONS = {
  limits: {
    fileSize: 25 * 1024 * 1024
  }
};

@Controller("attendance-operations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AttendanceOperationsController {
  constructor(
    @Inject(AttendanceOperationsService)
    private readonly attendanceOperations: AttendanceOperationsService
  ) {}

  @Post("imports")
  @UseInterceptors(FileInterceptor("file", FILE_INTERCEPTOR_OPTIONS))
  uploadAttendanceImport(
    @UploadedFile() file: AttendanceUploadedFile | undefined,
    @Body() dto: UploadAttendanceImportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attendanceOperations.uploadAttendanceImport({
      file,
      periodFrom: dto.periodFrom,
      periodTo: dto.periodTo,
      uploadMode: dto.uploadMode,
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Get("imports")
  listImports(@Query() query: ListAttendanceImportsQueryDto) {
    return this.attendanceOperations.listImports(query);
  }

  @Get("imports/:id")
  getImport(@Param("id", ParseUUIDPipe) id: string) {
    return this.attendanceOperations.getImport(id);
  }

  @Get("imports/:id/issues")
  listImportIssues(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ListAttendanceImportIssuesQueryDto
  ) {
    return this.attendanceOperations.listImportIssues(id, query);
  }

  @Post("historical-assignments/preview")
  @UseInterceptors(FileInterceptor("file", FILE_INTERCEPTOR_OPTIONS))
  previewHistoricalAssignments(
    @UploadedFile() file: AttendanceUploadedFile | undefined,
    @Body() dto: PreviewHistoricalAssignmentsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attendanceOperations.previewHistoricalAssignments({
      file,
      periodFrom: dto.periodFrom,
      periodTo: dto.periodTo,
      actorUserId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @Post("historical-assignments/confirm")
  @UseInterceptors(FileInterceptor("file", FILE_INTERCEPTOR_OPTIONS))
  confirmHistoricalAssignments(
    @UploadedFile() file: AttendanceUploadedFile | undefined,
    @Body() dto: ConfirmHistoricalAssignmentsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attendanceOperations.confirmHistoricalAssignments({
      file,
      periodFrom: dto.periodFrom,
      periodTo: dto.periodTo,
      actorUserId: user.id,
      confirmationText: dto.confirmationText,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }
}
