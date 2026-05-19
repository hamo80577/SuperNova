import { Gender, UserRole } from "@prisma/client";
import {
  ArrayNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
  IsUUID,
  Matches,
  MaxLength
} from "class-validator";

export class CreateNewHireRequestDto {
  @IsOptional()
  @IsEnum(UserRole)
  targetRole?: UserRole;

  @IsOptional()
  @IsUUID()
  sourceVendorId?: string;

  @IsOptional()
  @IsUUID()
  sourceChainId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  chainIds?: string[];

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
  @Matches(/^\d+$/, { message: "phoneNumber must contain numbers only." })
  @Matches(/^\d{11}$/, { message: "phoneNumber must be exactly 11 digits." })
  @Matches(/^(010|011|012|015)/, {
    message: "phoneNumber must start with 010, 011, 012, or 015."
  })
  phoneNumber!: string;

  @IsString()
  @Matches(/^\d+$/, { message: "nationalId must contain numbers only." })
  @Matches(/^\d{14}$/, { message: "nationalId must be exactly 14 digits." })
  nationalId!: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]*$/, {
    message: "shopperId may contain letters, numbers, underscores, and hyphens only."
  })
  shopperId?: string;
}
