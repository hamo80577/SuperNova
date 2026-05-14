import { Inject, Injectable } from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStatus,
  ApprovalStep,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  ProfileStatus,
  RequestStatus,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";
import { PrismaService } from "../prisma/prisma.service";

const activePickerWhere = {
  status: AssignmentStatus.ACTIVE,
  picker: {
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    role: UserRole.PICKER
  }
} satisfies Prisma.PickerBranchAssignmentWhereInput;

const pendingRequestStatuses = [
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN
];

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAdminOverview() {
    const [
      totalChains,
      activeChains,
      totalVendors,
      activeVendors,
      usersByRole,
      usersByAccountStatus,
      usersByEmploymentStatus,
      usersByBlockStatus,
      requestsByType,
      requestsByStatus,
      pendingApprovalsCount,
      pendingAdminFinalActionsCount,
      profileCompletionSummary,
      archivedPickers,
      temporaryBlockArchivedUsers,
      permanentBlockArchivedUsers,
      noBlockArchivedUsers,
      activePickerAssignments,
      topVendorsRaw
    ] = await this.prisma.$transaction([
      this.prisma.chain.count(),
      this.prisma.chain.count({ where: { status: ChainStatus.ACTIVE } }),
      this.prisma.vendor.count(),
      this.prisma.vendor.count({ where: { status: VendorStatus.ACTIVE } }),
      this.prisma.user.groupBy({
        by: ["role"],
        _count: { _all: true },
        orderBy: { role: "asc" }
      }),
      this.prisma.user.groupBy({
        by: ["accountStatus"],
        _count: { _all: true },
        orderBy: { accountStatus: "asc" }
      }),
      this.prisma.user.groupBy({
        by: ["employmentStatus"],
        _count: { _all: true },
        orderBy: { employmentStatus: "asc" }
      }),
      this.prisma.user.groupBy({
        by: ["blockStatus"],
        _count: { _all: true },
        orderBy: { blockStatus: "asc" }
      }),
      this.prisma.request.groupBy({
        by: ["type"],
        _count: { _all: true },
        orderBy: { type: "asc" }
      }),
      this.prisma.request.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { status: "asc" }
      }),
      this.prisma.requestApproval.count({
        where: { status: ApprovalStatus.PENDING }
      }),
      this.prisma.request.count({
        where: {
          status: RequestStatus.PENDING_ADMIN,
          currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
          approvals: {
            some: {
              step: ApprovalStep.ADMIN_FINAL_APPROVAL,
              status: ApprovalStatus.PENDING
            }
          }
        }
      }),
      this.prisma.user.groupBy({
        by: ["profileStatus"],
        where: { role: UserRole.PICKER },
        _count: { _all: true },
        orderBy: { profileStatus: "asc" }
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.PICKER,
          OR: [
            { accountStatus: { not: AccountStatus.ACTIVE } },
            { employmentStatus: { not: EmploymentStatus.ACTIVE } }
          ]
        }
      }),
      this.prisma.user.count({
        where: {
          blockStatus: BlockStatus.TEMPORARY_BLOCK,
          OR: [
            { accountStatus: { not: AccountStatus.ACTIVE } },
            { employmentStatus: { not: EmploymentStatus.ACTIVE } }
          ]
        }
      }),
      this.prisma.user.count({
        where: {
          blockStatus: BlockStatus.PERMANENT_BLOCK,
          OR: [
            { accountStatus: { not: AccountStatus.ACTIVE } },
            { employmentStatus: { not: EmploymentStatus.ACTIVE } }
          ]
        }
      }),
      this.prisma.user.count({
        where: {
          blockStatus: BlockStatus.NO_BLOCK,
          OR: [
            { accountStatus: { not: AccountStatus.ACTIVE } },
            { employmentStatus: { not: EmploymentStatus.ACTIVE } }
          ]
        }
      }),
      this.prisma.pickerBranchAssignment.findMany({
        where: activePickerWhere,
        include: { vendor: { include: { chain: true } } }
      }),
      this.prisma.pickerBranchAssignment.groupBy({
        by: ["vendorId"],
        where: activePickerWhere,
        _count: { _all: true },
        orderBy: { _count: { vendorId: "desc" } },
        take: 8
      })
    ]);

    const topVendorIds = topVendorsRaw.map((item) => item.vendorId);
    const topVendors = topVendorIds.length
      ? await this.prisma.vendor.findMany({
          where: { id: { in: topVendorIds } },
          include: { chain: true }
        })
      : [];
    const vendorById = new Map(topVendors.map((vendor) => [vendor.id, vendor]));
    const chainCounts = new Map<
      string,
      { chain: ReturnType<typeof toChainSummary>; activePickerCount: number }
    >();

    activePickerAssignments.forEach((assignment) => {
      const chain = assignment.vendor.chain;
      const current = chainCounts.get(chain.id);
      chainCounts.set(chain.id, {
        chain: toChainSummary(chain),
        activePickerCount: (current?.activePickerCount ?? 0) + 1
      });
    });

    return {
      scopeSummary: { scope: "SYSTEM" },
      cards: {
        totalChains,
        activeChains,
        totalVendors,
        activeVendors,
        activePickers: activePickerAssignments.length,
        archivedDeactivatedPickers: archivedPickers,
        pendingApprovals: pendingApprovalsCount,
        pendingAdminFinalActions: pendingAdminFinalActionsCount
      },
      breakdowns: {
        usersByRole: enumCounts(UserRole, usersByRole, "role"),
        usersByAccountStatus: enumCounts(
          AccountStatus,
          usersByAccountStatus,
          "accountStatus"
        ),
        usersByEmploymentStatus: enumCounts(
          EmploymentStatus,
          usersByEmploymentStatus,
          "employmentStatus"
        ),
        usersByBlockStatus: enumCounts(
          BlockStatus,
          usersByBlockStatus,
          "blockStatus"
        ),
        requestsByType: enumCounts(RequestType, requestsByType, "type"),
        requestsByStatus: enumCounts(RequestStatus, requestsByStatus, "status"),
        profileCompletion: enumCounts(
          ProfileStatus,
          profileCompletionSummary,
          "profileStatus"
        ),
        archiveBlockSummary: {
          archivedUsers: archivedPickers,
          temporaryBlock: temporaryBlockArchivedUsers,
          permanentBlock: permanentBlockArchivedUsers,
          noBlockAmongArchived: noBlockArchivedUsers
        }
      },
      tables: {
        topChainsByActivePickerCount: Array.from(chainCounts.values())
          .sort((left, right) => right.activePickerCount - left.activePickerCount)
          .slice(0, 8),
        topVendorsByActivePickerCount: topVendorsRaw.map((item) => ({
          vendor: vendorById.get(item.vendorId)
            ? toVendorSummary(vendorById.get(item.vendorId)!)
            : null,
          activePickerCount: groupCount(item)
        }))
      }
    };
  }

  async getAreaManagerOverview(areaManagerId: string) {
    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: { areaManagerId, status: AssignmentStatus.ACTIVE },
      include: {
        chain: {
          include: {
            vendors: {
              include: {
                pickerAssignments: {
                  where: activePickerWhere,
                  include: { picker: true }
                },
                champAssignments: {
                  where: {
                    status: AssignmentStatus.ACTIVE,
                    champ: { accountStatus: AccountStatus.ACTIVE }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const chainIds = assignments.map((assignment) => assignment.chainId);
    const vendorIds = assignments.flatMap((assignment) =>
      assignment.chain.vendors.map((vendor) => vendor.id)
    );

    const [
      requestsByType,
      requestsByStatus,
      pendingApprovals,
      profileCompletionSummary,
      archiveBlockSummary
    ] = chainIds.length
      ? await this.prisma.$transaction([
          this.prisma.request.groupBy({
            by: ["type"],
            where: {
              OR: [
                { sourceChainId: { in: chainIds } },
                { destinationChainId: { in: chainIds } }
              ]
            },
            _count: { _all: true },
            orderBy: { type: "asc" }
          }),
          this.prisma.request.groupBy({
            by: ["status"],
            where: {
              OR: [
                { sourceChainId: { in: chainIds } },
                { destinationChainId: { in: chainIds } }
              ]
            },
            _count: { _all: true },
            orderBy: { status: "asc" }
          }),
          this.prisma.requestApproval.count({
            where: {
              status: ApprovalStatus.PENDING,
              approverId: areaManagerId,
              request: {
                currentStep: { not: null },
                status: { in: pendingRequestStatuses }
              }
            }
          }),
          this.prisma.user.groupBy({
            by: ["profileStatus"],
            where: {
              role: UserRole.PICKER,
              accountStatus: AccountStatus.ACTIVE,
              employmentStatus: EmploymentStatus.ACTIVE,
              pickerBranchAssignments: {
                some: {
                  vendorId: { in: vendorIds },
                  status: AssignmentStatus.ACTIVE
                }
              }
            },
            _count: { _all: true },
            orderBy: { profileStatus: "asc" }
          }),
          this.prisma.user.groupBy({
            by: ["blockStatus"],
            where: {
              role: UserRole.PICKER,
              pickerBranchAssignments: {
                some: { vendorId: { in: vendorIds } }
              },
              OR: [
                { accountStatus: { not: AccountStatus.ACTIVE } },
                { employmentStatus: { not: EmploymentStatus.ACTIVE } }
              ]
            },
            _count: { _all: true },
            orderBy: { blockStatus: "asc" }
          })
        ])
      : [[], [], 0, [], []];

    const chains = assignments.map((assignment) => {
      const vendors = assignment.chain.vendors.map((vendor) => ({
        vendor: toVendorSummary(vendor),
        activePickerCount: vendor.pickerAssignments.length,
        activeChampCount: vendor.champAssignments.length
      }));

      return {
        chain: toChainSummary(assignment.chain),
        vendorCount: vendors.length,
        activePickerCount: vendors.reduce(
          (total, vendor) => total + vendor.activePickerCount,
          0
        ),
        activeChampCount: vendors.reduce(
          (total, vendor) => total + vendor.activeChampCount,
          0
        ),
        vendors
      };
    });

    return {
      scopeSummary: {
        assignedChains: chains.length,
        assignedVendors: vendorIds.length
      },
      cards: {
        chains: chains.length,
        vendors: vendorIds.length,
        activePickers: chains.reduce(
          (total, chain) => total + chain.activePickerCount,
          0
        ),
        activeChamps: chains.reduce(
          (total, chain) => total + chain.activeChampCount,
          0
        ),
        pendingApprovals,
        openActions: pendingApprovals
      },
      breakdowns: {
        requestsByType: enumCounts(RequestType, requestsByType, "type"),
        requestsByStatus: enumCounts(RequestStatus, requestsByStatus, "status"),
        profileCompletion: enumCounts(
          ProfileStatus,
          profileCompletionSummary,
          "profileStatus"
        ),
        archiveBlockSummary: enumCounts(
          BlockStatus,
          archiveBlockSummary,
          "blockStatus"
        )
      },
      tables: {
        chains,
        vendors: chains.flatMap((chain) =>
          chain.vendors.map((vendor) => ({
            ...vendor,
            chain: chain.chain
          }))
        )
      }
    };
  }

  async getChampOverview(champId: string) {
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { champId, status: AssignmentStatus.ACTIVE },
      include: {
        vendor: {
          include: {
            chain: true,
            pickerAssignments: {
              where: activePickerWhere,
              include: { picker: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const vendorIds = assignments.map((assignment) => assignment.vendorId);
    const [
      requestsByType,
      requestsByStatus,
      openSubmittedRequests,
      profileCompletionSummary,
      newHiresCompleted,
      transfersCompleted,
      offboardingCompleted
    ] = await this.prisma.$transaction([
      this.prisma.request.groupBy({
        by: ["type"],
        where: { createdById: champId },
        _count: { _all: true },
        orderBy: { type: "asc" }
      }),
      this.prisma.request.groupBy({
        by: ["status"],
        where: { createdById: champId },
        _count: { _all: true },
        orderBy: { status: "asc" }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          status: { in: pendingRequestStatuses }
        }
      }),
      this.prisma.user.groupBy({
        by: ["profileStatus"],
        where: {
          role: UserRole.PICKER,
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE,
          pickerBranchAssignments: {
            some: {
              vendorId: { in: vendorIds },
              status: AssignmentStatus.ACTIVE
            }
          }
        },
        _count: { _all: true },
        orderBy: { profileStatus: "asc" }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          type: RequestType.NEW_HIRE,
          status: RequestStatus.COMPLETED
        }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          type: RequestType.TRANSFER,
          status: RequestStatus.COMPLETED
        }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          type: RequestType.RESIGNATION,
          status: RequestStatus.COMPLETED
        }
      })
    ]);

    const branches = assignments.map((assignment) => ({
      vendor: toVendorSummary(assignment.vendor),
      chain: toChainSummary(assignment.vendor.chain),
      activePickerCount: assignment.vendor.pickerAssignments.length
    }));

    return {
      scopeSummary: {
        assignedBranches: branches.length
      },
      cards: {
        assignedBranches: branches.length,
        activePickers: branches.reduce(
          (total, branch) => total + branch.activePickerCount,
          0
        ),
        openSubmittedRequests,
        completedOutcomes:
          newHiresCompleted + transfersCompleted + offboardingCompleted
      },
      breakdowns: {
        profileCompletion: enumCounts(
          ProfileStatus,
          profileCompletionSummary,
          "profileStatus"
        ),
        requestsByType: enumCounts(RequestType, requestsByType, "type"),
        requestsByStatus: enumCounts(RequestStatus, requestsByStatus, "status"),
        workflowOutcomes: {
          newHiresCompleted,
          transfersCompleted,
          offboardingCompleted
        }
      },
      tables: {
        branches
      }
    };
  }
}

type GroupCountRow = Record<string, unknown> & {
  _count?: true | { _all?: number };
};

function enumCounts(
  enumObject: Record<string, string>,
  rows: GroupCountRow[],
  key: string
) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const groupKey = row[key];

    if (typeof groupKey === "string") {
      counts.set(groupKey, groupCount(row));
    }
  });

  return Object.values(enumObject).map((value) => ({
    key: value,
    count: counts.get(value) ?? 0
  }));
}

function groupCount(row: GroupCountRow) {
  return typeof row._count === "object" ? row._count._all ?? 0 : 0;
}
