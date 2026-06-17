import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches
} from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: "nationalId must contain numbers only." })
  @Matches(/^\d{14}$/, { message: "nationalId must be exactly 14 digits." })
  nationalId!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
