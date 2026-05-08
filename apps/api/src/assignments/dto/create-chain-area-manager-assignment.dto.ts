import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class CreateChainAreaManagerAssignmentDto {
  @IsUUID()
  chainId!: string;

  @IsUUID()
  areaManagerId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
