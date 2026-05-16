export type UserRole =
  | "PICKER"
  | "CHAMP"
  | "AREA_MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type AccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
export type EmploymentStatus =
  | "NEW_HIRE_PENDING"
  | "ACTIVE"
  | "RESIGNED"
  | "ARCHIVED";
export type ProfileStatus = "INCOMPLETE" | "PENDING_REVIEW" | "COMPLETE";
export type BlockStatus = "NO_BLOCK" | "TEMPORARY_BLOCK" | "PERMANENT_BLOCK";
export type Gender = "MALE" | "FEMALE" | "UNSPECIFIED";
export type UiTheme =
  | "ORANGE"
  | "TEAL"
  | "BLUE"
  | "EMERALD"
  | "VIOLET"
  | "SLATE";

export interface SafeUser {
  id: string;
  ibsId: string | null;
  shopperId: string | null;
  role: UserRole;
  nameEn: string;
  nameAr: string | null;
  phoneNumber: string;
  nationalId: string | null;
  address: string | null;
  dateOfBirth: string | null;
  gender: Gender;
  uiTheme: UiTheme;
  joiningDate: string | null;
  employmentStatus: EmploymentStatus;
  resignationDate: string | null;
  accountStatus: AccountStatus;
  profileStatus: ProfileStatus;
  blockStatus: BlockStatus;
  blockedUntil: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: SafeUser;
  redirectTo: string;
  mustChangePassword: boolean;
}
