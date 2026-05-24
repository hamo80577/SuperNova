import {
  AttendanceImportMode,
  AttendanceImportStatus,
  AttendanceIssueSeverity
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min
} from "class-validator";

export enum AttendanceMaintenanceOperation {
  DELETE_RANGE = "DELETE_RANGE",
  DELETE_MONTH = "DELETE_MONTH",
  DELETE_ALL = "DELETE_ALL",
  RECALCULATE_SUMMARIES = "RECALCULATE_SUMMARIES",
  COMPRESS_OLD_MONTHS = "COMPRESS_OLD_MONTHS"
}

export class UploadAttendanceImportDto {
  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;

  @IsEnum(AttendanceImportMode)
  uploadMode!: AttendanceImportMode;
}

export class ListAttendanceImportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsEnum(AttendanceImportStatus)
  status?: AttendanceImportStatus;

  @IsOptional()
  @IsEnum(AttendanceImportMode)
  mode?: AttendanceImportMode;

  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;
}

export class ListAttendanceImportIssuesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsEnum(AttendanceIssueSeverity)
  severity?: AttendanceIssueSeverity;
}

export class PreviewHistoricalAssignmentsDto {
  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;
}

export class ConfirmHistoricalAssignmentsDto extends PreviewHistoricalAssignmentsDto {
  @IsString()
  confirmationText!: string;
}

export class PreviewAttendanceMaintenanceDto {
  @IsEnum(AttendanceMaintenanceOperation)
  operation!: AttendanceMaintenanceOperation;

  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  monthKey?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  beforeMonthKey?: string;
}

export class DeleteAttendanceRangeDto {
  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;

  @IsString()
  confirmationText!: string;
}

export class DeleteAttendanceMonthDto {
  @Matches(/^\d{4}-\d{2}$/)
  monthKey!: string;

  @IsString()
  confirmationText!: string;
}

export class DeleteAllAttendanceDataDto {
  @IsString()
  confirmationText!: string;
}

export class RecalculateAttendanceSummariesDto {
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  monthKey?: string;

  @IsString()
  confirmationText!: string;
}

export class CompressOldAttendanceMonthsDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  beforeMonthKey?: string;

  @IsString()
  confirmationText!: string;
}
