export const APP_NAME = "SuperNova";

export const CORE_DOMAIN_NOTE =
  "Assignments + Requests + Approvals + Role-based Workspaces";

export const WORKFLOW_GUARDRAIL =
  "Sensitive picker lifecycle changes must happen through request-based workflows.";

export const ROLE_REDIRECTS = {
  PICKER: "/picker/dashboard",
  CHAMP: "/champ/dashboard",
  AREA_MANAGER: "/area-manager/dashboard",
  ADMIN: "/admin/dashboard",
  SUPER_ADMIN: "/admin/dashboard"
} as const;
