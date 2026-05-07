import type {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  nameEn: string;
  phoneNumber: string;
  accountStatus: AccountStatus;
  employmentStatus: EmploymentStatus;
  profileStatus: ProfileStatus;
  mustChangePassword: boolean;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
}
