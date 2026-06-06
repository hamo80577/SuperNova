import { IsIn, IsOptional, IsString } from "class-validator";

export const workforceSummaryPeriods = ["this-month"] as const;
export type WorkforceSummaryPeriod = (typeof workforceSummaryPeriods)[number];

export const workforceSummaryRoles = [
  "PICKER",
  "CHAMP",
  "MANAGEMENT",
  "ALL"
] as const;
export type WorkforceSummaryRole = (typeof workforceSummaryRoles)[number];

export class WorkforceSummaryQueryDto {
  @IsOptional()
  @IsIn(workforceSummaryPeriods)
  period?: WorkforceSummaryPeriod = "this-month";

  @IsOptional()
  @IsIn(workforceSummaryRoles)
  role?: WorkforceSummaryRole = "PICKER";

  @IsOptional()
  @IsString()
  chainId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  areaManagerId?: string;

  @IsOptional()
  @IsString()
  champId?: string;
}
