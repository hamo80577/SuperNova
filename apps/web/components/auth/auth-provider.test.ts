import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "auth-provider.tsx");
const source = readFileSync(sourcePath, "utf8");

if (source.includes("from \"next/navigation\"")) {
  throw new Error(
    "AuthProvider must not depend on next/navigation; it can render before the App Router context is available."
  );
}
