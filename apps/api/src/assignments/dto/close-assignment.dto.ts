import { IsDateString, IsOptional } from "class-validator";

export class CloseAssignmentDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
