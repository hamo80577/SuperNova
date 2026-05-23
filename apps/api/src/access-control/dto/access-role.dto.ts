import { AccessRoleKind, AccessRoleStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from "class-validator";

export class ListAccessRolesQueryDto {
  @IsOptional()
  @IsEnum(AccessRoleKind)
  kind?: AccessRoleKind;

  @IsOptional()
  @IsEnum(AccessRoleStatus)
  status?: AccessRoleStatus;

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

export class CreateCustomAccessRoleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionKeys?: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class UpdateCustomAccessRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class DeactivateCustomAccessRoleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsBoolean()
  revokeActiveAssignments?: boolean;
}

export class SyncCustomAccessRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionKeys!: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
