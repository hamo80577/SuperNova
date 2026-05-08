import { IsEnum, IsObject, IsOptional, IsUUID } from "class-validator";
import { RequestType } from "@prisma/client";

export class CreateRequestDto {
  @IsEnum(RequestType)
  type!: RequestType;

  @IsOptional()
  @IsUUID()
  sourceChainId?: string;

  @IsOptional()
  @IsUUID()
  sourceVendorId?: string;

  @IsOptional()
  @IsUUID()
  destinationChainId?: string;

  @IsOptional()
  @IsUUID()
  destinationVendorId?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
