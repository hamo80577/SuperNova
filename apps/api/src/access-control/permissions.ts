export const PermissionGroups = {
  REQUESTS_APPROVALS: "Requests & Approvals",
  USERS_PROFILES: "Users & Profiles",
  ORGANIZATION: "Organization",
  REPORTS: "Reports",
  AUDIT_LOGS: "Audit Logs",
  ACCESS_CONTROL: "Access Control",
  SYSTEM_SETTINGS: "System Settings",
  NOTIFICATIONS: "Notifications"
} as const;

export type PermissionGroup =
  (typeof PermissionGroups)[keyof typeof PermissionGroups];

export const PERMISSION_GROUPS = [
  PermissionGroups.REQUESTS_APPROVALS,
  PermissionGroups.USERS_PROFILES,
  PermissionGroups.ORGANIZATION,
  PermissionGroups.REPORTS,
  PermissionGroups.AUDIT_LOGS,
  PermissionGroups.ACCESS_CONTROL,
  PermissionGroups.SYSTEM_SETTINGS,
  PermissionGroups.NOTIFICATIONS
] as const satisfies readonly PermissionGroup[];

export const PermissionRiskLevels = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
} as const;

export type PermissionRiskLevel =
  (typeof PermissionRiskLevels)[keyof typeof PermissionRiskLevels];

export const PermissionKeys = {
  REQUESTS_VIEW: "requests.view",
  REQUESTS_CREATE_NEW_HIRE_PICKER: "requests.new_hire.picker.create",
  REQUESTS_CREATE_NEW_HIRE_CHAMP: "requests.new_hire.champ.create",
  REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER:
    "requests.new_hire.area_manager.create",
  REQUESTS_CREATE_RESIGNATION_PICKER: "requests.resignation.picker.create",
  REQUESTS_CREATE_RESIGNATION_CHAMP: "requests.resignation.champ.create",
  REQUESTS_CREATE_RESIGNATION_AREA_MANAGER:
    "requests.resignation.area_manager.create",
  REQUESTS_CREATE_TRANSFER_PICKER: "requests.transfer.picker.create",
  REQUESTS_CREATE_DEDUCTION_PICKER: "requests.deduction.picker.create",
  REQUESTS_CREATE_DEDUCTION_CHAMP: "requests.deduction.champ.create",
  DEDUCTIONS_VIEW: "deductions.view",
  DEDUCTIONS_POLICY_MANAGE: "deductions.policy.manage",
  REQUESTS_CANCEL: "requests.cancel",
  APPROVALS_VIEW_PENDING: "approvals.pending.view",
  APPROVALS_DECIDE_BRANCH: "approvals.branch.decide",
  APPROVALS_DECIDE_CHAIN: "approvals.chain.decide",
  APPROVALS_DECIDE_FINAL_LIFECYCLE: "approvals.final_lifecycle.decide",

  USERS_VIEW_SELF: "users.self.view",
  USERS_EDIT_OWN_PREFERENCES: "users.preferences.edit_own",
  USERS_VIEW_OPERATIONAL_PROFILE: "users.operational_profile.view",
  USERS_LIST_OPERATIONAL: "users.operational_list.view",
  USERS_EDIT_PROFILE: "users.profile.edit",
  USERS_COMPLETE_OWN_PICKER_PROFILE: "users.picker_profile.complete_own",
  USERS_MANAGE_TEMPORARY_PASSWORD: "users.temporary_password.manage",
  USERS_READ_TEMPORARY_PASSWORD: "users.temporary_password.read",
  USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS:
    "users.area_manager_chain_assignments.manage",

  ORGANIZATION_VIEW: "organization.view",
  ORGANIZATION_MANAGE_CHAINS: "organization.chains.manage",
  ORGANIZATION_MANAGE_BRANCHES: "organization.branches.manage",
  ORGANIZATION_MANAGE_CHAMP_ASSIGNMENTS:
    "organization.champ_assignments.manage",
  ORGANIZATION_MANAGE_AREA_MANAGER_ASSIGNMENTS:
    "organization.area_manager_assignments.manage",
  ASSIGNMENTS_VIEW: "assignments.view",

  REPORTS_VIEW_ADMIN: "reports.admin.view",
  REPORTS_VIEW_AREA_MANAGER: "reports.area_manager.view",
  REPORTS_VIEW_CHAMP: "reports.champ.view",
  REPORTS_EXPORT: "reports.export",

  AUDIT_LOGS_VIEW: "audit_logs.view",
  AUDIT_LOGS_EXPORT: "audit_logs.export",

  ACCESS_CONTROL_VIEW: "access_control.view",
  ACCESS_CONTROL_VIEW_ROLE_MATRIX: "access_control.role_matrix.view",
  ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX:
    "access_control.system_role_matrix.manage",
  ACCESS_CONTROL_VIEW_CUSTOM_ROLES: "access_control.custom_roles.view",
  ACCESS_CONTROL_MANAGE_CUSTOM_ROLES: "access_control.custom_roles.manage",
  ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES: "access_control.custom_roles.assign",
  ACCESS_CONTROL_REVOKE_CUSTOM_ROLES: "access_control.custom_roles.revoke",
  ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS:
    "access_control.effective_permissions.view",
  ACCESS_CONTROL_VIEW_ACCESS_AUDIT: "access_control.audit.view",

  SYSTEM_SETTINGS_VIEW: "system_settings.view",
  SYSTEM_SETTINGS_MANAGE: "system_settings.manage",
  SYSTEM_SETTINGS_MANAGE_SECURITY: "system_settings.security.manage",

  NOTIFICATIONS_VIEW: "notifications.view",
  NOTIFICATIONS_MANAGE_OWN: "notifications.own.manage",
  NOTIFICATIONS_TARGET_ADMINS: "notifications.admin_targeting.manage",
  NOTIFICATIONS_SEND_SYSTEM: "notifications.system.send"
} as const;

export type PermissionKey = (typeof PermissionKeys)[keyof typeof PermissionKeys];

export type PermissionDefinition = Readonly<{
  key: PermissionKey;
  label: string;
  description: string;
  group: PermissionGroup;
  riskLevel: PermissionRiskLevel;
  assignable: boolean;
  systemOnly: boolean;
}>;

export const PERMISSION_DEFINITIONS = [
  {
    key: PermissionKeys.REQUESTS_VIEW,
    label: "View requests",
    description: "View lifecycle requests within the actor's allowed scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_PICKER,
    label: "Create Picker New Hire requests",
    description: "Create Picker New Hire workflow requests within allowed scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_CHAMP,
    label: "Create Champ New Hire requests",
    description: "Create Champ New Hire workflow requests within allowed scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_NEW_HIRE_AREA_MANAGER,
    label: "Create Area Manager New Hire requests",
    description:
      "Create Area Manager New Hire workflow requests within allowed scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_RESIGNATION_PICKER,
    label: "Create Picker Resignation requests",
    description:
      "Create Picker Resignation workflow requests within allowed scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_RESIGNATION_CHAMP,
    label: "Create Champ Resignation requests",
    description:
      "Create Champ Resignation workflow requests within allowed scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_RESIGNATION_AREA_MANAGER,
    label: "Create Area Manager Resignation requests",
    description:
      "Create Area Manager Resignation workflow requests within allowed scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_TRANSFER_PICKER,
    label: "Create Picker Transfer requests",
    description: "Create Picker Transfer workflow requests within allowed scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_DEDUCTION_PICKER,
    label: "Create Picker Deduction tickets",
    description:
      "Create Deduction tickets for Pickers within allowed branch or chain scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CREATE_DEDUCTION_CHAMP,
    label: "Create Champ Deduction tickets",
    description:
      "Create Deduction tickets for Champs within allowed chain scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.DEDUCTIONS_VIEW,
    label: "View deductions",
    description:
      "View deduction cases within the actor's allowed scope (own records for Pickers).",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.LOW,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.DEDUCTIONS_POLICY_MANAGE,
    label: "Manage deduction policy",
    description:
      "Manage deduction policy versions, actions, and occurrence rules.",
    group: PermissionGroups.SYSTEM_SETTINGS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REQUESTS_CANCEL,
    label: "Cancel requests",
    description: "Cancel draft or pending lifecycle requests where authorized.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.APPROVALS_VIEW_PENDING,
    label: "View pending approvals",
    description:
      "View approval steps pending for the authenticated actor within workflow scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.APPROVALS_DECIDE_BRANCH,
    label: "Decide branch approvals",
    description:
      "Approve or reject branch authority approval steps (e.g. Champ approving a Picker annual leave request) in scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.APPROVALS_DECIDE_CHAIN,
    label: "Decide chain approvals",
    description: "Approve or reject chain authority approval steps in scope.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.APPROVALS_DECIDE_FINAL_LIFECYCLE,
    label: "Decide final lifecycle approvals",
    description: "Complete final lifecycle approval steps after prior approvals.",
    group: PermissionGroups.REQUESTS_APPROVALS,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: true,
    systemOnly: false
  },

  {
    key: PermissionKeys.USERS_VIEW_SELF,
    label: "View own profile",
    description: "View the authenticated user's own safe profile.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.LOW,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.USERS_EDIT_OWN_PREFERENCES,
    label: "Edit own preferences",
    description: "Update the authenticated user's own UI/user preferences.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.LOW,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.USERS_VIEW_OPERATIONAL_PROFILE,
    label: "View operational profiles",
    description: "View user operational profile data within allowed scope.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.USERS_LIST_OPERATIONAL,
    label: "List operational users",
    description: "List operational users with assignment context in scope.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.USERS_EDIT_PROFILE,
    label: "Edit user profiles",
    description: "Edit operational user identity and profile fields.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.USERS_COMPLETE_OWN_PICKER_PROFILE,
    label: "Complete own Picker profile",
    description: "Complete the authenticated Picker's required profile fields.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.LOW,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.USERS_MANAGE_TEMPORARY_PASSWORD,
    label: "Manage temporary passwords",
    description: "Reset or regenerate temporary credentials where authorized.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.USERS_READ_TEMPORARY_PASSWORD,
    label: "Reveal temporary passwords",
    description: "Reveal an active temporary password through credential controls.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS,
    label: "Manage Area Manager Chain assignments",
    description: "Add or close Area Manager Chain assignments from profiles.",
    group: PermissionGroups.USERS_PROFILES,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },

  {
    key: PermissionKeys.ORGANIZATION_VIEW,
    label: "View organization",
    description: "View Chains, Branches, and current assignment context.",
    group: PermissionGroups.ORGANIZATION,
    riskLevel: PermissionRiskLevels.LOW,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.ORGANIZATION_MANAGE_CHAINS,
    label: "Manage Chains",
    description: "Create or update Chain records when organization controls allow it.",
    group: PermissionGroups.ORGANIZATION,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.ORGANIZATION_MANAGE_BRANCHES,
    label: "Manage Branches",
    description: "Create or update Branch records when organization controls allow it.",
    group: PermissionGroups.ORGANIZATION,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.ORGANIZATION_MANAGE_CHAMP_ASSIGNMENTS,
    label: "Manage Champ assignments",
    description: "Create or close Branch-Champ assignments through admin controls.",
    group: PermissionGroups.ORGANIZATION,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.ORGANIZATION_MANAGE_AREA_MANAGER_ASSIGNMENTS,
    label: "Manage Area Manager assignments",
    description: "Create or close Chain-Area Manager assignments where permitted.",
    group: PermissionGroups.ORGANIZATION,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.ASSIGNMENTS_VIEW,
    label: "View assignments",
    description: "View Picker, Champ, and Area Manager assignment records.",
    group: PermissionGroups.ORGANIZATION,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },

  {
    key: PermissionKeys.REPORTS_VIEW_ADMIN,
    label: "View admin reports",
    description: "View global operational reports for administrative users.",
    group: PermissionGroups.REPORTS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REPORTS_VIEW_AREA_MANAGER,
    label: "View Area Manager reports",
    description: "View Chain-scoped reports for assigned Area Manager scope.",
    group: PermissionGroups.REPORTS,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REPORTS_VIEW_CHAMP,
    label: "View Champ reports",
    description: "View Branch-scoped reports for assigned Champ scope.",
    group: PermissionGroups.REPORTS,
    riskLevel: PermissionRiskLevels.MEDIUM,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.REPORTS_EXPORT,
    label: "Export reports",
    description: "Export operational report data when export surfaces exist.",
    group: PermissionGroups.REPORTS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },

  {
    key: PermissionKeys.AUDIT_LOGS_VIEW,
    label: "View audit logs",
    description: "View audit logs for operational and administrative actions.",
    group: PermissionGroups.AUDIT_LOGS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.AUDIT_LOGS_EXPORT,
    label: "Export audit logs",
    description: "Export audit log records when export surfaces exist.",
    group: PermissionGroups.AUDIT_LOGS,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: true,
    systemOnly: false
  },

  {
    key: PermissionKeys.ACCESS_CONTROL_VIEW,
    label: "View access control",
    description: "View access-control catalog and system role policy surfaces.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_VIEW_ROLE_MATRIX,
    label: "View system role matrix",
    description: "View the system role-to-permission matrix.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_MANAGE_SYSTEM_ROLE_MATRIX,
    label: "Manage system role matrix",
    description: "Manage system-level role permission mapping in future phases.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_VIEW_CUSTOM_ROLES,
    label: "View custom access roles",
    description: "View custom access roles and read-only access role metadata.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_MANAGE_CUSTOM_ROLES,
    label: "Manage custom access roles",
    description:
      "Create, update, deactivate, and manage custom access role metadata.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES,
    label: "Assign custom access roles",
    description: "Assign active custom access roles to users.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_REVOKE_CUSTOM_ROLES,
    label: "Revoke custom access roles",
    description: "Revoke active custom access role assignments from users.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS,
    label: "View effective permissions",
    description:
      "View a user's effective permissions from base role and custom access role assignments.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.ACCESS_CONTROL_VIEW_ACCESS_AUDIT,
    label: "View access-control audit",
    description:
      "View audit records related to access roles, permission changes, and user access-role assignments.",
    group: PermissionGroups.ACCESS_CONTROL,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: false,
    systemOnly: true
  },

  {
    key: PermissionKeys.SYSTEM_SETTINGS_VIEW,
    label: "View system settings",
    description: "View future system-owner settings surfaces.",
    group: PermissionGroups.SYSTEM_SETTINGS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.SYSTEM_SETTINGS_MANAGE,
    label: "Manage system settings",
    description: "Manage future system-owner settings surfaces.",
    group: PermissionGroups.SYSTEM_SETTINGS,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.SYSTEM_SETTINGS_MANAGE_SECURITY,
    label: "Manage security settings",
    description: "Manage future platform security settings.",
    group: PermissionGroups.SYSTEM_SETTINGS,
    riskLevel: PermissionRiskLevels.CRITICAL,
    assignable: false,
    systemOnly: true
  },

  {
    key: PermissionKeys.NOTIFICATIONS_VIEW,
    label: "View notifications",
    description: "View notifications addressed to the authenticated user.",
    group: PermissionGroups.NOTIFICATIONS,
    riskLevel: PermissionRiskLevels.LOW,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.NOTIFICATIONS_MANAGE_OWN,
    label: "Manage own notifications",
    description: "Mark the authenticated user's notifications as read.",
    group: PermissionGroups.NOTIFICATIONS,
    riskLevel: PermissionRiskLevels.LOW,
    assignable: true,
    systemOnly: false
  },
  {
    key: PermissionKeys.NOTIFICATIONS_TARGET_ADMINS,
    label: "Target admin notifications",
    description: "Create notifications for Admin final approval audiences.",
    group: PermissionGroups.NOTIFICATIONS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: false,
    systemOnly: true
  },
  {
    key: PermissionKeys.NOTIFICATIONS_SEND_SYSTEM,
    label: "Send system notifications",
    description: "Send future system-originated notifications.",
    group: PermissionGroups.NOTIFICATIONS,
    riskLevel: PermissionRiskLevels.HIGH,
    assignable: false,
    systemOnly: true
  }
] as const satisfies readonly PermissionDefinition[];

const permissionDefinitionsByKey = PERMISSION_DEFINITIONS.reduce(
  (index, permission) => {
    index[permission.key] = permission;
    return index;
  },
  {} as Record<PermissionKey, PermissionDefinition>
);

const permissionsByGroup = PERMISSION_GROUPS.reduce(
  (index, group) => {
    index[group] = PERMISSION_DEFINITIONS.filter(
      (permission) => permission.group === group
    );
    return index;
  },
  {} as Record<PermissionGroup, readonly PermissionDefinition[]>
);

export const PERMISSION_DEFINITION_BY_KEY: Readonly<
  Record<PermissionKey, PermissionDefinition>
> = Object.freeze(permissionDefinitionsByKey);

export const PERMISSIONS_BY_GROUP: Readonly<
  Record<PermissionGroup, readonly PermissionDefinition[]>
> = Object.freeze(permissionsByGroup);

export function getPermissionDefinition(permissionKey: PermissionKey) {
  return PERMISSION_DEFINITION_BY_KEY[permissionKey];
}

export function listPermissions(): readonly PermissionDefinition[] {
  return PERMISSION_DEFINITIONS;
}

export function listPermissionsByGroup() {
  return PERMISSIONS_BY_GROUP;
}

/*
 * Do not export workflow-bypass permissions for direct Picker creation,
 * direct Picker transfer, direct Picker archive/deactivation, direct active
 * Picker assignment edits, or approval bypass. Sensitive lifecycle changes
 * must remain Request -> Approval -> System applies change.
 */
