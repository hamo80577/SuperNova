import { type Vendor } from "@/lib/api/organization";

export function filterVendors(vendors: Vendor[], chainId: string, queryValue: string) {
  return vendors
    .filter((vendor) => !chainId || vendor.chainId === chainId)
    .filter((vendor) => {
      const query = queryValue.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [vendor.vendorName, vendor.vendorCode, vendor.chain.chainName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
}
