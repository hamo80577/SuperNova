# Attendance Calculation Rules

## Row Eligibility

Calculate only rows where:

```text
Division = Egypt
```

Rows outside Egypt are ignored and counted in the import summary.

## Worked Shift

A worked shift is:

```text
Status in ["On Time", "Late"]
```

## Late Minutes

Late minutes:

```text
Actual Checkin Time - Shift Scheduled Start Time
```

Store as:

```text
lateMinutes = max(0, difference in minutes)
```

For these statuses:

```text
Absent
On Leave
Off Day
```

store:

```text
lateMinutes = 0
```

## Late Levels

Late Level 1:

```text
lateMinutes > 15
```

Late Level 2:

```text
lateMinutes > 30 AND lateMinutes <= 45
```

Late Level 3:

```text
lateMinutes > 45
```

Late Level 1 intentionally overlaps with Level 2 and Level 3 because it is an over-15-minutes indicator.

## Status Metrics

Absent:

```text
Status = "Absent"
```

On Leave:

```text
Status = "On Leave"
```

Annual Leave:

```text
Shift Name contains "Annual Leave"
```

Medical Leave:

```text
Shift Name contains "Medical Leave"
```

Off Day:

```text
Shift Name contains "Off Day"
```

Under 8 Hours:

```text
Actual Work Duration (hrs) < 8 AND worked shift
```

Over 15 Hours:

```text
Actual Work Duration (hrs) > 15 AND worked shift
```

## Shift Counts

Total Created Shifts:

```text
Count of matched attendance rows inside selected period
```

Total Shifts Needed:

```text
Calculated from requested period and adjusted by User.joiningDate
```

Formula:

```text
neededFrom = periodFrom

If User.joiningDate exists and is after periodFrom:
neededFrom = User.joiningDate

If User.joiningDate is after periodTo:
totalShiftsNeeded = 0

Otherwise:
totalShiftsNeeded = inclusive calendar days between neededFrom and periodTo
```

Missing Shifts:

```text
max(0, totalShiftsNeeded - totalCreatedShifts)
```

## Duplicates

If duplicate `Identifier + Shift Date` exists, create an import warning.

Do not silently hide duplicates.
