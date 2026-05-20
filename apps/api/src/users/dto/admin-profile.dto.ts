import { Gender } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class UpdateAdminProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalDateInput(value))
  @IsISO8601()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalDateInput(value))
  @IsISO8601()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shopperId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ibsId?: string;
}

function normalizeOptionalDateInput(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}
