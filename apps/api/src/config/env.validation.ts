import { plainToInstance } from "class-transformer";
import { IsNumberString, IsString, validateSync } from "class-validator";

class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsNumberString()
  API_PORT!: string;
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
