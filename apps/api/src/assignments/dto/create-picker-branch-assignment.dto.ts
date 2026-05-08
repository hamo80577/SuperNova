import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class CreatePickerBranchAssignmentDto {
  @IsUUID()
  pickerId!: string;

  @IsUUID()
  vendorId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
