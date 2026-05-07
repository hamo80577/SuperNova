import { plainToInstance } from "class-transformer";
import { IsNumberString, IsOptional, IsString, MinLength, validateSync } from "class-validator";

class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsNumberString()
  API_PORT!: string;

  @IsString()
  WEB_ORIGIN!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES_IN!: string;

  @IsString()
  AUTH_COOKIE_NAME!: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_PHONE?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_NAME?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
