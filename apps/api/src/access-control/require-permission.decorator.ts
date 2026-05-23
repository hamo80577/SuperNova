import { SetMetadata } from "@nestjs/common";

import type { PermissionKey } from "./permissions";

export const REQUIRED_PERMISSION_KEY = "supernova:required-permission";

export function RequirePermission(permission: PermissionKey) {
  return SetMetadata(REQUIRED_PERMISSION_KEY, permission);
}
