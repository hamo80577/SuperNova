import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

import { OFFBOARDING_BLOCK_DECISIONS } from "../../requests/workflows/offboarding-workflow.policy";

export class ApprovalDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]*$/, {
    message: "shopperId may contain letters, numbers, underscores, and hyphens only."
  })
  shopperId?: string;
}
