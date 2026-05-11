import { Gender } from "@prisma/client";
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
  @IsISO8601()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
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
