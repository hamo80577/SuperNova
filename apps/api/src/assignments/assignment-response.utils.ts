import type { Chain, User, Vendor } from "@prisma/client";

export function toUserSummary(user: User) {
  return {
    id: user.id,
    role: user.role,
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    phoneNumber: user.phoneNumber,
    accountStatus: user.accountStatus,
    employmentStatus: user.employmentStatus,
    profileStatus: user.profileStatus
  };
}

export function toChainSummary(chain: Chain) {
  return {
    id: chain.id,
    chainName: chain.chainName,
    chainCode: chain.chainCode,
    status: chain.status
  };
}

export function toVendorSummary(vendor: Vendor & { chain?: Chain }) {
  return {
    id: vendor.id,
    vendorName: vendor.vendorName,
    vendorCode: vendor.vendorCode,
    vendorExternalId: vendor.vendorExternalId,
    status: vendor.status,
    chainId: vendor.chainId,
    area: vendor.area,
    city: vendor.city,
    chain: vendor.chain ? toChainSummary(vendor.chain) : undefined
  };
}
