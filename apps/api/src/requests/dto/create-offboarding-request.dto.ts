import { RequestType } from "@prisma/client";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateOffboardingRequestDto {
  @IsIn([RequestType.RESIGNATION])
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
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
