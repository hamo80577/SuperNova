import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateTransferRequestDto {
  @IsUUID()
  sourceVendorId!: string;

  @IsUUID()
  targetUserId!: string;

  @IsUUID()
  destinationVendorId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsDateString()
  requestedTransferDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
