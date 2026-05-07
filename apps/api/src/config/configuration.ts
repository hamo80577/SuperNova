export default () => ({
  api: {
    port: Number(process.env.API_PORT ?? 4000)
  },
  database: {
    url: process.env.DATABASE_URL ?? ""
  }
});
