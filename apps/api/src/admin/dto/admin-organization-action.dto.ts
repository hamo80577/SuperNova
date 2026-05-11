import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class AdminAssignPickerDto {
  @IsUUID()
  pickerId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class AdminReplaceBranchChampDto {
  @IsUUID()
  champId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class AdminReplaceChainAreaManagerDto {
  @IsUUID()
  areaManagerId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
