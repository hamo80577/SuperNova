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

import {
  OFFBOARDING_BLOCK_DECISIONS,
  OFFBOARDING_REASON_CODES
} from "../workflows/offboarding-workflow.policy";

export class CreateOffboardingRequestDto {
  @IsIn([RequestType.RESIGNATION])
  type!: RequestType;

  @IsOptional()
  @IsUUID()
  sourceVendorId?: string;

  @IsUUID()
  targetUserId!: string;

  @IsIn(OFFBOARDING_REASON_CODES)
  reasonCode!: string;

  @IsDateString()
  resignationDate!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reasonDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsIn(OFFBOARDING_BLOCK_DECISIONS)
  blockDecision?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  blockReason?: string;
}
