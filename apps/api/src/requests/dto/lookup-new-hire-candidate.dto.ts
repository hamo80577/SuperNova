import { IsOptional, IsString, MaxLength } from "class-validator";

export class LookupNewHireCandidateDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalId?: string;
}
