import type {
  AccountStatus,
  BlockStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  User,
  UserRole
} from "@prisma/client";

export interface SafeUserDto {
  id: string;
  ibsId: string | null;
  shopperId: string | null;
  role: UserRole;
  nameEn: string;
  nameAr: string | null;
  phoneNumber: string;
  nationalId: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  gender: Gender;
  joiningDate: Date | null;
  employmentStatus: EmploymentStatus;
  resignationDate: Date | null;
  accountStatus: AccountStatus;
  profileStatus: ProfileStatus;
  blockStatus: BlockStatus;
  blockedUntil: Date | null;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSafeUser(user: User): SafeUserDto {
  return {
    id: user.id,
    ibsId: user.ibsId,
    shopperId: user.shopperId,
    role: user.role,
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    phoneNumber: user.phoneNumber,
    nationalId: user.nationalId,
    address: user.address,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    joiningDate: user.joiningDate,
    employmentStatus: user.employmentStatus,
    resignationDate: user.resignationDate,
    accountStatus: user.accountStatus,
    profileStatus: user.profileStatus,
    blockStatus: user.blockStatus,
    blockedUntil: user.blockedUntil,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
