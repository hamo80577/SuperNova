import type { RedisOptions } from "ioredis";

export function redisConnectionFromUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use the redis:// or rediss:// protocol.");
  }

  const databaseText = url.pathname.replace(/^\//, "");
  const database = databaseText ? Number(databaseText) : 0;

  if (!Number.isInteger(database) || database < 0) {
    throw new Error("REDIS_URL database must be a non-negative integer.");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: database,
    maxRetriesPerRequest: null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {})
  };
}
