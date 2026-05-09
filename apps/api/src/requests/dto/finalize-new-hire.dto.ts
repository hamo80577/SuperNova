import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class FinalizeNewHireDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: "shopperId may contain letters, numbers, underscores, and hyphens only."
  })
  shopperId!: string;
}
