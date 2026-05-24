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
  Max,
  Min
} from "class-validator";

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
