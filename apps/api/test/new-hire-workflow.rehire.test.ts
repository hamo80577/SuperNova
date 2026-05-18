import assert from "node:assert/strict";

import {
  AccountStatus,
  ApprovalStep,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  UserRole,
  VendorStatus
} from "@prisma/client";

import { NewHireCandidateService } from "../src/requests/workflows/new-hire-candidate.service";
import { NewHireWorkflowService } from "../src/requests/workflows/new-hire-workflow.service";

const phoneNumber = "01012345678";
const nationalId = "12345678901234";

function candidateUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "old-user-1",
    role: UserRole.PICKER,
    nameEn: "Previous User",
    nameAr: null,
    phoneNumber,
    nationalId,
    address: null,
    dateOfBirth: null,
    gender: Gender.UNSPECIFIED,
    shopperId: null,
    accountStatus: AccountStatus.ARCHIVED,
    employmentStatus: EmploymentStatus.RESIGNED,
    profileStatus: ProfileStatus.COMPLETE,
    blockStatus: BlockStatus.NO_BLOCK,
    blockedUntil: null,
    blockReason: null,
    pickerBranchAssignments: [],
    vendorChampAssignments: [],
    chainAreaManagerAssignments: [],
    ...overrides
  } as any;
}

function candidateServiceWithMatches(users: any[], duplicateRequest: unknown = null) {
  return new NewHireCandidateService({
    user: {
      findMany: async () => users
    },
    request: {
      findFirst: async () => duplicateRequest
    }
  } as any);
}

async function assertCreateRehireWithoutEditableNames(targetRole: UserRole.PICKER | UserRole.CHAMP) {
  let validated = false;
  const sourceVendor = {
    id: "vendor-1",
    vendorName: "Branch One",
    vendorCode: "B1",
    status: VendorStatus.ACTIVE,
    chainId: "chain-1",
    chain: {
      id: "chain-1",
      chainName: "Chain One",
      chainCode: "C1",
      status: ChainStatus.ACTIVE
    }
  };
  const workflow = new NewHireWorkflowService(
    {
      vendor: {
        findUnique: async () => sourceVendor
      },
      vendorChampAssignment: {
        findFirst: async () => null
      },
      chainAreaManagerAssignment: {
        findFirst: async () => ({ id: "assignment-1" })
      }
    } as any,
    {
      validateNewHireCandidateForCreate: async (
        candidate: any,
        rehireUserId: string | undefined,
        validatedTargetRole: UserRole
      ) => {
        validated = true;
        assert.equal(candidate.nameEn, undefined);
        assert.equal(candidate.nameAr, undefined);
        assert.equal(candidate.phoneNumber, phoneNumber);
        assert.equal(candidate.nationalId, nationalId);
        assert.equal(rehireUserId, "old-user-1");
        assert.equal(validatedTargetRole, targetRole);
        return {
          rehireUser: candidateUser({ id: "old-user-1", role: targetRole }),
          matchedBy: ["phoneNumber"]
        };
      }
    } as any,
    {} as any,
    {
      createBranchNewHire: async () => ({ id: `request-${targetRole}` })
    } as any,
    {
      resolveAreaManagerStep: async () => ({
        step: ApprovalStep.AREA_MANAGER_APPROVAL,
        approverRole: UserRole.AREA_MANAGER,
        approverId: "area-manager-1",
        chainId: "chain-1"
      })
    } as any
  );

  const created = await workflow.createNewHire(
    {
      targetRole,
      sourceVendorId: "vendor-1",
      phoneNumber,
      nationalId,
      rehireUserId: "old-user-1"
    },
    {
      actor: {
        id: "admin-1",
        role: UserRole.ADMIN
      } as any
    }
  );

  assert.equal(validated, true);
  assert.equal((created as { id: string }).id, `request-${targetRole}`);
}

async function run() {
  await assertCreateRehireWithoutEditableNames(UserRole.PICKER);
  await assertCreateRehireWithoutEditableNames(UserRole.CHAMP);

  const picker = candidateUser({ id: "picker-1", role: UserRole.PICKER });
  const champ = candidateUser({ id: "champ-1", role: UserRole.CHAMP });

  const pickerValidation = await candidateServiceWithMatches([
    picker
  ]).validateNewHireCandidateForCreate(
    {
      phoneNumber,
      nationalId,
      gender: Gender.UNSPECIFIED
    },
    picker.id,
    UserRole.PICKER
  );
  assert.equal(pickerValidation.rehireUser?.id, picker.id);

  const champValidation = await candidateServiceWithMatches([
    champ
  ]).validateNewHireCandidateForCreate(
    {
      phoneNumber,
      nationalId,
      gender: Gender.UNSPECIFIED
    },
    champ.id,
    UserRole.CHAMP
  );
  assert.equal(champValidation.rehireUser?.id, champ.id);

  await assert.rejects(
    () =>
      candidateServiceWithMatches([]).validateNewHireCandidateForCreate(
        {
          phoneNumber,
          nationalId,
          gender: Gender.UNSPECIFIED
        },
        "area-manager-1",
        UserRole.AREA_MANAGER
      ),
    /Rehire applies to Picker or Champ New Hire only/
  );

  const evaluator = new NewHireCandidateService({} as any);
  assert.equal(
    evaluator.evaluateNewHireMatch(picker, { phoneNumber }, UserRole.PICKER)
      .decision,
    "REHIRE_AVAILABLE"
  );
  assert.equal(
    evaluator.evaluateNewHireMatch(champ, { phoneNumber }, UserRole.CHAMP).decision,
    "REHIRE_AVAILABLE"
  );
  assert.equal(
    evaluator.evaluateNewHireMatch(
      candidateUser({ role: UserRole.AREA_MANAGER }),
      { phoneNumber },
      UserRole.AREA_MANAGER
    ).decision,
    "ACTIVE_DUPLICATE"
  );
  assert.equal(
    evaluator.evaluateNewHireMatch(
      candidateUser({
        blockStatus: BlockStatus.TEMPORARY_BLOCK,
        blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }),
      { phoneNumber },
      UserRole.PICKER
    ).decision,
    "TEMPORARY_BLOCKED"
  );
  assert.equal(
    evaluator.evaluateNewHireMatch(
      candidateUser({
        blockStatus: BlockStatus.TEMPORARY_BLOCK,
        blockedUntil: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }),
      { phoneNumber },
      UserRole.PICKER
    ).decision,
    "REHIRE_AVAILABLE"
  );
  assert.equal(
    evaluator.evaluateNewHireMatch(
      candidateUser({ blockStatus: BlockStatus.PERMANENT_BLOCK }),
      { phoneNumber },
      UserRole.PICKER
    ).decision,
    "PERMANENT_BLOCKED"
  );
  assert.equal(
    evaluator.evaluateNewHireMatch(
      candidateUser({
        pickerBranchAssignments: [{ status: AssignmentStatus.ACTIVE }]
      }),
      { phoneNumber },
      UserRole.PICKER
    ).decision,
    "ACTIVE_DUPLICATE"
  );
  assert.equal(
    evaluator.evaluateNewHireMatch(
      candidateUser({
        role: UserRole.CHAMP,
        vendorChampAssignments: [{ status: AssignmentStatus.ACTIVE }]
      }),
      { phoneNumber },
      UserRole.CHAMP
    ).decision,
    "ACTIVE_DUPLICATE"
  );

  await assert.rejects(
    () =>
      candidateServiceWithMatches([picker], { id: "request-1" })
        .validateNewHireCandidateForCreate(
          {
            phoneNumber,
            nationalId,
            gender: Gender.UNSPECIFIED
          },
          picker.id,
          UserRole.PICKER
        ),
    /pending New Hire or Rehire request already exists/
  );

  await assert.rejects(
    () =>
      candidateServiceWithMatches([
        candidateUser({
          id: "eligible-picker",
          phoneNumber,
          nationalId: "11111111111111",
          role: UserRole.PICKER
        }),
        candidateUser({
          id: "active-national-id-match",
          phoneNumber: "01099999999",
          nationalId,
          role: UserRole.PICKER,
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE,
          pickerBranchAssignments: [{ status: AssignmentStatus.ACTIVE }]
        })
      ]).validateNewHireCandidateForCreate(
        {
          phoneNumber,
          nationalId,
          gender: Gender.UNSPECIFIED
        },
        "eligible-picker",
        UserRole.PICKER
      ),
    /Previous Picker already has an active Branch assignment/
  );
}

void run();
