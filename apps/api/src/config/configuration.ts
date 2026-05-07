export default () => ({
  api: {
    port: Number(process.env.API_PORT ?? 4000)
  },
  database: {
    url: process.env.DATABASE_URL ?? ""
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? "",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
    cookieName: process.env.AUTH_COOKIE_NAME ?? "supernova_session",
    webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    isProduction: process.env.NODE_ENV === "production"
  }
});
