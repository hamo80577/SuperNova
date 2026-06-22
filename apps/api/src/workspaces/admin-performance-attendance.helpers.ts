import { AttendanceLocationMappingStatus } from "@prisma/client";

type VendorScopedAttendanceRecord = {
  userId: string;
  reportedVendorId: string | null;
  locationMappingStatus: AttendanceLocationMappingStatus;
};

export function filterVendorScopedAttendance<
  TRecord extends VendorScopedAttendanceRecord
>(options: {
  records: TRecord[];
  vendorIds: string[];
  pickerIds: string[];
  champIds: string[];
}) {
  const vendorIds = new Set(options.vendorIds);
  const pickerIds = new Set(options.pickerIds);
  const champIds = new Set(options.champIds);

  return options.records.filter((record) => {
    if (pickerIds.has(record.userId)) {
      return true;
    }

    return (
      champIds.has(record.userId) &&
      record.reportedVendorId !== null &&
      vendorIds.has(record.reportedVendorId) &&
      isReliableVendorMapping(record.locationMappingStatus)
    );
  });
}

function isReliableVendorMapping(status: AttendanceLocationMappingStatus) {
  return (
    status === AttendanceLocationMappingStatus.MAPPED_VENDOR_CODE ||
    status === AttendanceLocationMappingStatus.MAPPED_VENDOR_EXTERNAL_ID
  );
}

