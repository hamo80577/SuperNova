export default () => ({
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
      process.env.TEMP_PASSWORD_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "",
    cookieName: process.env.AUTH_COOKIE_NAME ?? "supernova_session",
    webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    isProduction: process.env.NODE_ENV === "production"
  }
});
