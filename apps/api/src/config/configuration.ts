export default () => {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    api: {
      port: Number(process.env.API_PORT ?? 4000),
      requestLogger: process.env.API_REQUEST_LOGGER
    },
    database: {
      url: process.env.DATABASE_URL ?? ""
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET ?? "",
      jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
      rememberMeJwtExpiresIn:
        process.env.AUTH_REMEMBER_ME_JWT_EXPIRES_IN ?? "30d",
      temporaryPasswordEncryptionKey:
        process.env.TEMP_PASSWORD_ENCRYPTION_KEY ??
        (isProduction ? "" : process.env.JWT_SECRET ?? ""),
      cookieName: process.env.AUTH_COOKIE_NAME ?? "supernova_session",
      webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
      isProduction
    },
    hrSync: {
      enabled: process.env.HR_SYNC_ENABLED === "true",
      webAppUrl: process.env.HR_SYNC_WEB_APP_URL ?? "",
      secret: process.env.HR_SYNC_SECRET ?? ""
    }
  };
};
