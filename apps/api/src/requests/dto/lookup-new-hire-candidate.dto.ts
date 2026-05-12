import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class LookupNewHireCandidateDto {
  @IsOptional()
  @IsUUID()
  sourceVendorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalId?: string;
}
