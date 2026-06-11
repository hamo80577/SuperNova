import { UserRole } from "@prisma/client";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength
} from "class-validator";

export class PreviewDeductionDto {
  @IsUUID()
  targetUserId!: string;

  @IsOptional()
  @IsIn([UserRole.PICKER, UserRole.CHAMP])
  targetRole?: UserRole;

  @IsUUID()
  actionId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "incidentDate must use YYYY-MM-DD format."
  })
  incidentDate!: string;

  @IsOptional()
  @IsUUID()
  sourceVendorId?: string;
}

export class CreateDeductionRequestDto extends PreviewDeductionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
