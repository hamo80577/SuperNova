import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      "New password must include uppercase, lowercase, and numeric characters."
  })
  newPassword!: string;
}
