import { ChainStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateChainDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  chainName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  chainCode?: string;

  @IsOptional()
  @IsEnum(ChainStatus)
  status?: ChainStatus;
}
