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
      approveAreaManagerApproval: async () => ({ id: "approval-request" })
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
      ...(targetRole === UserRole.PICKER
        ? { actualJoiningDate: "2026-06-01" }
        : {}),
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

async function assertAreaManagerPickerNewHireCapturesShopperId() {
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
  let capturedBranchContext: any = null;
  const workflow = new NewHireWorkflowService(
    {
      vendor: {
        findUnique: async () => sourceVendor
      },
      user: {
        findUnique: async () => null
      },
      vendorChampAssignment: {
        findFirst: async () => null
      },
      chainAreaManagerAssignment: {
        findFirst: async () => ({ id: "assignment-1" })
      }
    } as any,
    {
      validateNewHireCandidateForCreate: async () => ({
        rehireUser: null,
        matchedBy: []
      })
    } as any,
    {} as any,
    {
      createBranchNewHire: async (_candidate: any, branchContext: any) => {
        capturedBranchContext = branchContext;
        return { id: "request-1" };
      }
    } as any,
    {
      approveAreaManagerApproval: async () => ({ id: "approval-request" })
    } as any,
    {} as any
  );

  await assert.rejects(
    () =>
      workflow.createNewHire(
        {
          targetRole: UserRole.PICKER,
          sourceVendorId: "vendor-1",
          firstNameEn: "New",
          secondNameEn: "Middle",
          thirdNameEn: "Picker",
          phoneNumber,
          nationalId,
          actualJoiningDate: "2026-06-01"
        },
        { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
      ),
    /Shopper ID is required when Area Manager submits Picker New Hire/
  );

  await workflow.createNewHire(
    {
      targetRole: UserRole.PICKER,
      sourceVendorId: "vendor-1",
      firstNameEn: "New",
      secondNameEn: "Middle",
      thirdNameEn: "Picker",
      phoneNumber,
      nationalId,
      actualJoiningDate: "2026-06-01",
      shopperId: " SHOP_789 "
    },
    { actor: { id: "area-manager-1", role: UserRole.AREA_MANAGER } as any }
  );

  assert.equal(capturedBranchContext.areaManagerCapturedShopperId, "SHOP_789");
}

async function assertNewHireStoresStructuredEnglishName() {
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
  let capturedCandidate: any = null;
  const workflow = new NewHireWorkflowService(
    {
      vendor: {
        findUnique: async () => sourceVendor
      },
      vendorChampAssignment: {
        findFirst: async () => null
      }
    } as any,
    {
      validateNewHireCandidateForCreate: async (candidate: any) => ({
        rehireUser: null,
        matchedBy: []
      })
    } as any,
    {} as any,
    {
      createBranchNewHire: async (candidate: any) => {
        capturedCandidate = candidate;
        return { id: "picker-request" };
      }
    } as any,
    {} as any,
    {
      resolveAreaManagerStep: async () => ({
        step: ApprovalStep.AREA_MANAGER_APPROVAL,
        approverRole: UserRole.AREA_MANAGER,
        approverId: "area-manager-1",
        chainId: "chain-1"
      })
    } as any
  );

  await workflow.createNewHire(
    {
      targetRole: UserRole.PICKER,
      sourceVendorId: "vendor-1",
      firstNameEn: " Picker ",
      secondNameEn: " Middle ",
      thirdNameEn: " One ",
      phoneNumber,
      nationalId,
      actualJoiningDate: "2026-06-01"
    },
    { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
  );

  assert.equal(capturedCandidate.firstNameEn, "Picker");
  assert.equal(capturedCandidate.secondNameEn, "Middle");
  assert.equal(capturedCandidate.thirdNameEn, "One");
  assert.equal(capturedCandidate.nameEn, "Picker Middle One");

  await assert.rejects(
    () =>
      workflow.createNewHire(
        {
          targetRole: UserRole.PICKER,
          sourceVendorId: "vendor-1",
          firstNameEn: "Picker",
          secondNameEn: "",
          thirdNameEn: "One",
          phoneNumber,
          nationalId,
          actualJoiningDate: "2026-06-01"
        },
        { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
      ),
    /Candidate first, second, and third English names are required/
  );
}

async function assertAreaManagerNewHireDoesNotRequireChainContext() {
  let capturedContext: any = null;
  const workflow = new NewHireWorkflowService(
    {} as any,
    {
      validateNewHireCandidateForCreate: async (
        candidate: any,
        rehireUserId: string | undefined,
        validatedTargetRole: UserRole
      ) => {
        assert.equal(candidate.phoneNumber, phoneNumber);
        assert.equal(candidate.nationalId, nationalId);
        assert.equal(rehireUserId, undefined);
        assert.equal(validatedTargetRole, UserRole.AREA_MANAGER);
        return {
          rehireUser: null,
          matchedBy: []
        };
      }
    } as any,
    {} as any,
    {
      createAreaManagerNewHire: async (_candidate: any, context: any) => {
        capturedContext = context;
        return { id: "area-manager-request" };
      }
    } as any,
    {} as any,
    {} as any
  );

  const created = await workflow.createNewHire(
    {
      targetRole: UserRole.AREA_MANAGER,
      firstNameEn: "New",
      secondNameEn: "Area",
      thirdNameEn: "Manager",
      phoneNumber,
      nationalId
    },
    { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
  );

  assert.equal((created as { id: string }).id, "area-manager-request");
  assert.equal(capturedContext.targetRole, UserRole.AREA_MANAGER);
  assert.equal("chainIds" in capturedContext, false);
}

async function assertPickerNewHireRequiresActualJoiningDate() {
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
  let capturedCandidate: any = null;
  const workflow = new NewHireWorkflowService(
    {
      vendor: {
        findUnique: async () => sourceVendor
      },
      vendorChampAssignment: {
        findFirst: async () => null
      }
    } as any,
    {
      validateNewHireCandidateForCreate: async (candidate: any) => ({
        rehireUser: null,
        matchedBy: []
      })
    } as any,
    {} as any,
    {
      createBranchNewHire: async (candidate: any) => {
        capturedCandidate = candidate;
        return { id: "picker-request" };
      }
    } as any,
    {} as any,
    {
      resolveAreaManagerStep: async () => ({
        step: ApprovalStep.AREA_MANAGER_APPROVAL,
        approverRole: UserRole.AREA_MANAGER,
        approverId: "area-manager-1",
        chainId: "chain-1"
      })
    } as any
  );

  await assert.rejects(
    () =>
      workflow.createNewHire(
        {
          targetRole: UserRole.PICKER,
          sourceVendorId: "vendor-1",
          firstNameEn: "New",
          secondNameEn: "Middle",
          thirdNameEn: "Picker",
          phoneNumber,
          nationalId
        },
        { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
      ),
    /actualJoiningDate is required for Picker New Hire\/Rehire/
  );

  await workflow.createNewHire(
    {
      targetRole: UserRole.PICKER,
      sourceVendorId: "vendor-1",
      firstNameEn: "New",
      secondNameEn: "Middle",
      thirdNameEn: "Picker",
      phoneNumber,
      nationalId,
      actualJoiningDate: "2026-06-01"
    },
    { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
  );

  assert.equal(capturedCandidate.actualJoiningDate, "2026-06-01");
}

async function assertPickerRehireRequiresActualJoiningDate() {
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
  let capturedCandidate: any = null;
  const workflow = new NewHireWorkflowService(
    {
      vendor: {
        findUnique: async () => sourceVendor
      },
      vendorChampAssignment: {
        findFirst: async () => null
      }
    } as any,
    {
      validateNewHireCandidateForCreate: async () => ({
        rehireUser: candidateUser({ id: "old-user-1", role: UserRole.PICKER }),
        matchedBy: ["phoneNumber"]
      })
    } as any,
    {} as any,
    {
      createBranchNewHire: async (candidate: any) => {
        capturedCandidate = candidate;
        return { id: "rehire-request" };
      }
    } as any,
    {} as any,
    {
      resolveAreaManagerStep: async () => ({
        step: ApprovalStep.AREA_MANAGER_APPROVAL,
        approverRole: UserRole.AREA_MANAGER,
        approverId: "area-manager-1",
        chainId: "chain-1"
      })
    } as any
  );

  await assert.rejects(
    () =>
      workflow.createNewHire(
        {
          targetRole: UserRole.PICKER,
          sourceVendorId: "vendor-1",
          phoneNumber,
          nationalId,
          rehireUserId: "old-user-1"
        },
        { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
      ),
    /actualJoiningDate is required for Picker New Hire\/Rehire/
  );

  await workflow.createNewHire(
    {
      targetRole: UserRole.PICKER,
      sourceVendorId: "vendor-1",
      phoneNumber,
      nationalId,
      rehireUserId: "old-user-1",
      actualJoiningDate: "2026-06-02"
    },
    { actor: { id: "admin-1", role: UserRole.ADMIN } as any }
  );

  assert.equal(capturedCandidate.actualJoiningDate, "2026-06-02");
}

async function run() {
  await assertCreateRehireWithoutEditableNames(UserRole.PICKER);
  await assertCreateRehireWithoutEditableNames(UserRole.CHAMP);
  await assertAreaManagerPickerNewHireCapturesShopperId();
  await assertNewHireStoresStructuredEnglishName();
  await assertAreaManagerNewHireDoesNotRequireChainContext();
  await assertPickerNewHireRequiresActualJoiningDate();
  await assertPickerRehireRequiresActualJoiningDate();

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
    /Phone number and National ID belong to different existing users. Resolve the identity conflict before submitting New Hire\/Rehire./
  );

  await assert.rejects(
    () =>
      candidateServiceWithMatches([
        candidateUser({
          id: "archived-phone-match",
          phoneNumber,
          nationalId: "11111111111111",
          role: UserRole.PICKER
        }),
        candidateUser({
          id: "archived-national-id-match",
          phoneNumber: "01099999999",
          nationalId,
          role: UserRole.PICKER
        })
      ]).validateNewHireCandidateForCreate(
        {
          phoneNumber,
          nationalId,
          gender: Gender.UNSPECIFIED
        },
        "archived-phone-match",
        UserRole.PICKER
      ),
    /Phone number and National ID belong to different existing users. Resolve the identity conflict before submitting New Hire\/Rehire./
  );

  await assert.rejects(
    () =>
      candidateServiceWithMatches([
        candidateUser({
          id: "archived-phone-match",
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
          employmentStatus: EmploymentStatus.ACTIVE
        })
      ]).validateNewHireCandidateForCreate(
        {
          phoneNumber,
          nationalId,
          gender: Gender.UNSPECIFIED
        },
        "archived-phone-match",
        UserRole.PICKER
      ),
    /Phone number and National ID belong to different existing users. Resolve the identity conflict before submitting New Hire\/Rehire./
  );

  const sameArchivedUserValidation = await candidateServiceWithMatches([
    candidateUser({
      id: "same-archived-user",
      phoneNumber,
      nationalId,
      role: UserRole.PICKER
    })
  ]).validateNewHireCandidateForCreate(
    {
      phoneNumber,
      nationalId,
      gender: Gender.UNSPECIFIED
    },
    "same-archived-user",
    UserRole.PICKER
  );
  assert.equal(sameArchivedUserValidation.rehireUser?.id, "same-archived-user");
  assert.deepEqual(sameArchivedUserValidation.matchedBy.sort(), [
    "nationalId",
    "phoneNumber"
  ]);
}

void run();
