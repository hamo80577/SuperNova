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

export class ListOrdersKpiPerformanceReportQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;

  @IsOptional()
  @IsIn(["CHAIN", "VENDOR", "PICKER"])
  view?: "CHAIN" | "VENDOR" | "PICKER";

  @IsOptional()
  @IsString()
  chainId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  pickerSearch?: string;

  @IsOptional()
  @IsIn([
    "totalOrders",
    "uho",
    "uhoRate",
    "notOnTime",
    "qcFailedOrders",
    "partialRefund",
    "oos",
    "priceModified"
  ])
  sortBy?:
    | "totalOrders"
    | "uho"
    | "uhoRate"
    | "notOnTime"
    | "qcFailedOrders"
    | "partialRefund"
    | "oos"
    | "priceModified";

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
