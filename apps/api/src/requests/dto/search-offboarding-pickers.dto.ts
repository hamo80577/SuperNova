import { UserRole } from "@prisma/client";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class SearchOffboardingPickersDto {
  @IsOptional()
  @IsIn([UserRole.PICKER, UserRole.CHAMP, UserRole.AREA_MANAGER])
  targetRole?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  sourceVendorId?: string;

  @IsOptional()
  @IsUUID()
  sourceChainId?: string;
}
