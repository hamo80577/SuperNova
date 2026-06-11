import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { DeductionActionStatus, DeductionPenaltyType } from "@prisma/client";

export class DeductionRuleStepInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  occurrenceNumber!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  appliesFromOccurrence?: number;

  @IsEnum(DeductionPenaltyType)
  penaltyType!: DeductionPenaltyType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(31)
  deductionDays?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;
}

export class UpdateDeductionActionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(DeductionActionStatus)
  status?: DeductionActionStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DeductionRuleStepInputDto)
  ruleSteps?: DeductionRuleStepInputDto[];
}

export class CreateDeductionActionDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, {
    message: "code must be UPPER_SNAKE_CASE."
  })
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DeductionRuleStepInputDto)
  ruleSteps!: DeductionRuleStepInputDto[];
}
