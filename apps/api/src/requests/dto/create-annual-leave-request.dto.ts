import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength
} from "class-validator";

export class CreateAnnualLeaveRequestDto {
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "startDate must use YYYY-MM-DD format."
  })
  startDate!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "endDate must use YYYY-MM-DD format."
  })
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsUUID()
  contextVendorId?: string;
}
