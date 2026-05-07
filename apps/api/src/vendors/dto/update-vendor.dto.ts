import { VendorStatus } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from "class-validator";

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  vendorName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  vendorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vendorExternalId?: string | null;

  @IsOptional()
  @IsUUID()
  chainId?: string;

  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;
}
