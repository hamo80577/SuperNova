import { AttendanceMatchedRole } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

const monthKeyPattern = /^\d{4}-\d{2}$/;

export class AttendanceMonthQueryDto {
  @IsOptional()
  @Matches(monthKeyPattern)
  monthKey?: string;
}

export class AttendanceOverviewQueryDto extends AttendanceMonthQueryDto {
  @IsOptional()
  @IsString()
  chainId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;
}

export class AttendanceChainsQueryDto extends AttendanceMonthQueryDto {}

export class AttendanceBranchesQueryDto extends AttendanceMonthQueryDto {
  @IsOptional()
  @IsString()
  chainId?: string;
}

export class AttendanceUsersQueryDto extends AttendanceOverviewQueryDto {
  @IsOptional()
  @IsEnum(AttendanceMatchedRole)
  role?: AttendanceMatchedRole;

  @IsOptional()
  @IsString()
  search?: string;

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
}

export class AttendanceUserDailyQueryDto {
  @Matches(monthKeyPattern)
  monthKey!: string;
}
