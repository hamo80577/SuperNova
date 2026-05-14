import {
  Equals,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

import { OFFBOARDING_BLOCK_DECISIONS } from "../workflows/offboarding-workflow.policy";

export class FinalizeOffboardingDto {
  @IsIn(OFFBOARDING_BLOCK_DECISIONS)
  blockDecision!: string;

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
