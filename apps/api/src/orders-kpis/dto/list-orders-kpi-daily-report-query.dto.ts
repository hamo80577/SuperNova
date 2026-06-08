import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min
} from "class-validator";

export class ListOrdersKpiDailyReportQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;

  @IsOptional()
  @IsString()
  shopperId?: string;

  @IsOptional()
  @IsString()
  pickerSearch?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  chainId?: string;

  @IsOptional()
  @IsIn([
    "date",
    "pickerName",
    "shopperId",
    "totalOrders",
    "successfulOrders",
    "successRate",
    "preparationTime"
  ])
  sortBy?:
    | "date"
    | "pickerName"
    | "shopperId"
    | "totalOrders"
    | "successfulOrders"
    | "successRate"
    | "preparationTime";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDirection?: "asc" | "desc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 50;
}
