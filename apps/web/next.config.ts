import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url))
};

export default nextConfig;
