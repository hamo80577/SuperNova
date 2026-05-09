import { BlockStatus } from "@prisma/client";
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class FinalizeOffboardingDto {
  @IsEnum(BlockStatus)
  blockStatus!: BlockStatus;

  @IsOptional()
  @IsDateString()
  blockedUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  blockReason?: string;

  @IsBoolean()
  @Equals(true, {
    message: "confirmInternalDeactivation must be true to finalize offboarding."
  })
  confirmInternalDeactivation!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
