import assert from "node:assert/strict";

import { validateEnvironment } from "../src/config/env.validation";

const validBaseEnv = {
  DATABASE_URL: "postgresql://supernova:supernova@localhost:5432/supernova_test",
  JWT_SECRET: "j".repeat(32),
  AUTH_COOKIE_NAME: "supernova_session",
  WEB_ORIGIN: "http://localhost:3000",
  NODE_ENV: "development"
};

function expectValidationError(
  env: Record<string, unknown>,
  expectedMessages: RegExp[]
) {
  assert.throws(
    () => validateEnvironment(env),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /API environment validation failed/);

      for (const expected of expectedMessages) {
        assert.match(error.message, expected);
      }

      assert.doesNotMatch(error.message, /postgresql:\/\/secret-user/);
      assert.doesNotMatch(error.message, /raw-secret-value/);
      return true;
    }
  );
}

validateEnvironment(validBaseEnv);

validateEnvironment({
  ...validBaseEnv,
  API_PORT: "4000",
  JWT_EXPIRES_IN: "8h"
});

validateEnvironment({
  ...validBaseEnv,
  NODE_ENV: "production",
  TEMP_PASSWORD_ENCRYPTION_KEY: "t".repeat(32)
});

expectValidationError(
  {
    ...validBaseEnv,
    DATABASE_URL: "   ",
    JWT_SECRET: "raw-secret-value",
    AUTH_COOKIE_NAME: "",
    WEB_ORIGIN: "not-an-origin"
  },
  [/DATABASE_URL/, /JWT_SECRET/, /AUTH_COOKIE_NAME/, /WEB_ORIGIN/]
);

expectValidationError(
  {
    ...validBaseEnv,
    WEB_ORIGIN: "http://localhost:3000/app"
  },
  [/WEB_ORIGIN must be a valid origin/]
);

expectValidationError(
  {
    ...validBaseEnv,
    DATABASE_URL: "postgresql://secret-user:raw-secret-value@localhost/db",
    NODE_ENV: "production"
  },
  [/TEMP_PASSWORD_ENCRYPTION_KEY/]
);
