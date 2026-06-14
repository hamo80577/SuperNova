import { IsIn, IsOptional, IsString, Matches } from "class-validator";

export const pickerPerformancePeriodLabels = [
  "LAST_WEEK",
  "THIS_MONTH",
  "THIS_QUARTER",
  "CUSTOM"
] as const;

export type PickerPerformancePeriodLabel =
  (typeof pickerPerformancePeriodLabels)[number];

export class PickerPerformanceSummaryQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo!: string;

  @IsOptional()
  @IsIn(pickerPerformancePeriodLabels)
  period?: PickerPerformancePeriodLabel;
}
