import { Gender } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength
} from "class-validator";

export class CreateNewHireRequestDto {
  @IsUUID()
  sourceVendorId!: string;

  @IsOptional()
  @IsUUID()
  rehireUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameAr?: string;

  @IsString()
  @MaxLength(40)
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
