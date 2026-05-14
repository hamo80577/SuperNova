import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class SearchOffboardingPickersDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  sourceVendorId?: string;
}
