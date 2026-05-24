import assert from "node:assert/strict";

import { AttendanceCalculationService } from "../src/attendance/attendance-calculation.service";

const service = new AttendanceCalculationService();

function at(time: string) {
  return new Date(`2026-05-10T${time}:00.000Z`);
}

const baseInput = {
  status: "Late",
  shiftName: "Morning Shift",
  scheduledStartAt: at("09:00"),
  actualCheckInAt: at("09:00"),
  actualWorkDurationHours: 8
};

assert.equal(
  service.calculateDailyMetrics({
    ...baseInput,
    status: "On Time",
    actualCheckInAt: at("08:55")
  }).lateMinutes,
  0
);

assert.equal(
  service.calculateDailyMetrics({
    ...baseInput,
    actualCheckInAt: at("09:20")
  }).lateMinutes,
  20
);

assert.equal(
  service.calculateDailyMetrics({
    ...baseInput,
    actualCheckInAt: at("09:16")
  }).lateLevel1Over15,
  true
);

const level2 = service.calculateDailyMetrics({
  ...baseInput,
  actualCheckInAt: at("09:40")
});
assert.equal(level2.lateLevel1Over15, true);
assert.equal(level2.lateLevel2From31To45, true);
assert.equal(level2.lateLevel3Over45, false);

const level3 = service.calculateDailyMetrics({
  ...baseInput,
  actualCheckInAt: at("09:50")
});
assert.equal(level3.lateLevel1Over15, true);
assert.equal(level3.lateLevel2From31To45, false);
assert.equal(level3.lateLevel3Over45, true);

for (const status of ["Absent", "On Leave", "Off Day"]) {
  assert.equal(
    service.calculateDailyMetrics({
      ...baseInput,
      status,
      actualCheckInAt: at("11:30")
    }).lateMinutes,
    0
  );
}

assert.equal(
  service.calculateDailyMetrics({
    ...baseInput,
    actualWorkDurationHours: 7.5
  }).isUnder8Hours,
  true
);
assert.equal(
  service.calculateDailyMetrics({
    ...baseInput,
    status: "Absent",
    actualWorkDurationHours: 7.5
  }).isUnder8Hours,
  false
);

assert.equal(
  service.calculateDailyMetrics({
    ...baseInput,
    actualWorkDurationHours: 15.5
  }).isOver15Hours,
  true
);
assert.equal(
  service.calculateDailyMetrics({
    ...baseInput,
    status: "On Leave",
    actualWorkDurationHours: 16
  }).isOver15Hours,
  false
);

const leaveFlags = service.calculateDailyMetrics({
  ...baseInput,
  status: "On Leave",
  shiftName: "Annual Leave / Medical Leave / Off Day"
});
assert.equal(leaveFlags.isAnnualLeave, true);
assert.equal(leaveFlags.isMedicalLeave, true);
assert.equal(leaveFlags.isOffDay, true);

assert.equal(
  service.calculateTotalShiftsNeeded({
    periodFrom: new Date("2026-05-01T00:00:00.000Z"),
    periodTo: new Date("2026-05-10T00:00:00.000Z"),
    joiningDate: new Date("2026-05-05T00:00:00.000Z")
  }),
  6
);

assert.equal(
  service.calculateTotalShiftsNeeded({
    periodFrom: new Date("2026-05-01T00:00:00.000Z"),
    periodTo: new Date("2026-05-10T00:00:00.000Z"),
    joiningDate: new Date("2026-06-01T00:00:00.000Z")
  }),
  0
);

