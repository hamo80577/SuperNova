import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class FinalizeNewHireDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]*$/, {
    message: "shopperId may contain letters, numbers, underscores, and hyphens only."
  })
  shopperId?: string;
}
