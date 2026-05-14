import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { OFFBOARDING_BLOCK_DECISIONS } from "../../requests/workflows/offboarding-workflow.policy";

export class ApprovalDecisionDto {
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
