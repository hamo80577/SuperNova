import { VendorStatus } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateVendorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  vendorName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  vendorCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vendorExternalId?: string;

  @IsUUID()
  chainId!: string;

  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;
}
