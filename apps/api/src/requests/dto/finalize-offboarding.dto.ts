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
  @IsOptional()
  @IsIn(OFFBOARDING_BLOCK_DECISIONS, {
    message:
      "Temporary block durations are no longer supported for Resignation. Use NO_BLOCK or PERMANENT."
  })
  blockDecision?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  blockReason?: string;

  @IsBoolean()
  @Equals(true, {
    message: "confirmInternalDeactivation must be true to finalize Resignation."
  })
  confirmInternalDeactivation!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
