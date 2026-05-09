import { RequestType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateOffboardingRequestDto {
  @IsEnum(RequestType)
  type!: RequestType;

  @IsUUID()
  sourceVendorId!: string;

  @IsUUID()
  targetUserId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsDateString()
  resignationDate?: string;

  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
