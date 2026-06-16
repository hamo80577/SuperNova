import { IsOptional, IsString, Matches } from "class-validator";

export class ChampPerformanceSummaryQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo!: string;

  @IsOptional()
  @IsString()
  vendorId?: string;
}
