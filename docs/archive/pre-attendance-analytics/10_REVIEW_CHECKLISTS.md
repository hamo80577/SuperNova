# 10 — Review Checklists

## General Review

Check:

```text
Does the change match the task?
Did it exceed scope?
Did it change behavior accidentally?
Were docs updated if behavior changed?
Were required checks run?
Are known risks honest?
```

## Backend Review

Check:

```text
Auth guard
Role guard
Operational scope
Entity state validation
Request state validation
Approval ownership
Transaction safety
Audit logs
Notification payload safety
No secrets exposed
No direct lifecycle bypass
```

## Frontend Review

Check:

```text
Mobile layout
No horizontal overflow
Loading state
Error state
Empty state
Validation messages
Primary action clarity
Role-specific visibility
No fake data
API errors handled
```

## Data Review

Check:

```text
No source-of-truth context on User
Assignments preserve history
No raw temporary password in notification
No sensitive payload data
Prisma schema changes have migration plan
Indexes support new queues/search
```

## New Hire Review

Check:

```text
targetRole permissions correct
Branch/Chain scope correct
Phone validation Egypt format
National ID validation 14 digits
Candidate lookup scoped
Blocked users cannot submit
Rehire Picker only
Area Manager creator skips AM approval
Admin-created Picker/Champ requires AM approval
Admin-created Area Manager completed immediately
Temporary password not in notification
Credential reveal/reset from profile only
Audit logs created
```

## Request Detail Review

Check:

```text
Request type/status visible
Creator visible
Target candidate/user visible
Source context visible
Approval steps visible
Current required action obvious
Timeline visible
Final result visible
```

## Completion Gate

A task can move forward only if:

```text
Scope respected
Checks run or justified
Manual verification done where needed
Security reviewed
Known risks acceptable
Product owner accepts behavior/UI
```
