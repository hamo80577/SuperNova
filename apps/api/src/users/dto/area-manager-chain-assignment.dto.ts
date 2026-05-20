import { ArrayNotEmpty, IsArray, IsUUID } from "class-validator";

export class AreaManagerChainAssignmentDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  chainIds!: string[];
}
