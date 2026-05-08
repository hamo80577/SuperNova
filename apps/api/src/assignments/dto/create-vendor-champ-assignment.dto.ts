import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class CreateVendorChampAssignmentDto {
  @IsUUID()
  vendorId!: string;

  @IsUUID()
  champId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
