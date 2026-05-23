import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AssignCustomAccessRoleDto {
  @IsString()
  accessRoleId!: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RevokeCustomAccessRoleAssignmentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
