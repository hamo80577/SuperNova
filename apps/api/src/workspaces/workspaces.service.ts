import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AccountStatus,
  AssignmentStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  RequestStatus,
  User,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";
import { PrismaService } from "../prisma/prisma.service";
import { toRequestSummary } from "../requests/request-response.utils";
import { toSafeUser } from "../users/dto/safe-user.dto";

const activePickerAssignmentInclude = {
  vendor: {
    include: {
      chain: true
    }
  }
} satisfies Prisma.PickerBranchAssignmentInclude;

const champBranchInclude = {
  vendor: {
    include: {
      chain: true,
      pickerAssignments: {
        where: {
          status: AssignmentStatus.ACTIVE,
          picker: {
            accountStatus: AccountStatus.ACTIVE,
            employmentStatus: EmploymentStatus.ACTIVE
          }
        },
        include: { picker: true },
        orderBy: { createdAt: "desc" as const }
      }
    }
  }
} satisfies Prisma.VendorChampAssignmentInclude;

const areaManagerChainInclude = {
  chain: {
    include: {
      vendors: {
        orderBy: { createdAt: "desc" as const },
        include: {
          pickerAssignments: {
            where: {
              status: AssignmentStatus.ACTIVE,
              picker: {
                accountStatus: AccountStatus.ACTIVE,
                employmentStatus: EmploymentStatus.ACTIVE
              }
            },
            include: { picker: true },
            orderBy: { createdAt: "desc" as const }
          },
          champAssignments: {
            where: { status: AssignmentStatus.ACTIVE },
            include: { champ: true },
            orderBy: { createdAt: "desc" as const }
          }
        }
      }
    }
  }
} satisfies Prisma.ChainAreaManagerAssignmentInclude;

const workspaceRequestInclude = {
  createdBy: true,
  targetUser: true,
  sourceChain: true,
  sourceVendor: { include: { chain: true } },
  destinationChain: true,
  destinationVendor: { include: { chain: true } },
  approvals: {
    include: { approver: true },
    orderBy: { createdAt: "asc" as const }
  }
} satisfies Prisma.RequestInclude;

type ChampBranchAssignment = Prisma.VendorChampAssignmentGetPayload<{
  include: typeof champBranchInclude;
}>;

const pendingRequestStatuses = [
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN
];

@Injectable()
export class WorkspacesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPickerWorkspace(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const pickerAssignment = await this.prisma.pickerBranchAssignment.findFirst({
      where: { pickerId: userId, status: AssignmentStatus.ACTIVE },
      include: activePickerAssignmentInclude
    });

    const [champAssignment, areaManagerAssignment] = pickerAssignment
      ? await this.prisma.$transaction([
          this.prisma.vendorChampAssignment.findFirst({
            where: {
              vendorId: pickerAssignment.vendorId,
              status: AssignmentStatus.ACTIVE
            },
            include: { champ: true }
          }),
          this.prisma.chainAreaManagerAssignment.findFirst({
            where: {
              chainId: pickerAssignment.vendor.chainId,
              status: AssignmentStatus.ACTIVE
            },
            include: { areaManager: true }
          })
        ])
      : [null, null];

    return {
      profile: toSafeUser(user),
      profileCompletion: this.getProfileCompletion(user),
      currentAssignment: pickerAssignment
        ? {
            id: pickerAssignment.id,
            status: pickerAssignment.status,
            startDate: pickerAssignment.startDate,
            endDate: pickerAssignment.endDate
          }
        : null,
      branch: pickerAssignment ? toVendorSummary(pickerAssignment.vendor) : null,
      chain: pickerAssignment ? toChainSummary(pickerAssignment.vendor.chain) : null,
      champ: champAssignment ? toUserSummary(champAssignment.champ) : null,
      areaManager: areaManagerAssignment
        ? toUserSummary(areaManagerAssignment.areaManager)
        : null
    };
  }

  async getChampWorkspace(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const branchData = await this.getChampBranches(userId);

    return {
      champ: toUserSummary(user),
      branches: branchData.branches,
      totals: {
        branches: branchData.branches.length,
        activePickers: branchData.branches.reduce(
          (total, branch) => total + branch.activePickerCount,
          0
        ),
        pendingRequests: branchData.totals.pendingRequests,
        recentRequests: branchData.totals.recentRequests
      },
      placeholders: {
        requests: "Request history is visible here; lifecycle forms launch from a selected Branch context.",
        actions: "New Hire, Offboarding, and Transfer remain request-based and Branch-contextual."
      }
    };
  }

  async getChampBranches(userId: string) {
    await this.getUserOrThrow(userId);
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { champId: userId, status: AssignmentStatus.ACTIVE },
      include: champBranchInclude,
      orderBy: { createdAt: "desc" }
    });

    const branches = await Promise.all(
      assignments.map((assignment) => this.toChampBranchSummary(assignment, userId))
    );

    return {
      branches,
      totals: {
        branches: branches.length,
        activePickers: branches.reduce(
          (total, branch) => total + branch.activePickerCount,
          0
        ),
        pendingRequests: branches.reduce(
          (total, branch) => total + branch.pendingRequestCount,
          0
        ),
        recentRequests: branches.reduce(
          (total, branch) => total + branch.recentRequestCount,
          0
        )
      }
    };
  }

  async getChampBranchDetail(userId: string, vendorId: string) {
    await this.getUserOrThrow(userId);
    const assignment = await this.prisma.vendorChampAssignment.findFirst({
      where: { champId: userId, vendorId, status: AssignmentStatus.ACTIVE },
      include: champBranchInclude
    });

    if (!assignment) {
      throw new NotFoundException("Assigned Branch was not found.");
    }

    const [
      areaManagerAssignment,
      recentRequests,
      recentRequestCount,
      pendingRequestCount
    ] = await this.prisma.$transaction([
      this.prisma.chainAreaManagerAssignment.findFirst({
        where: {
          chainId: assignment.vendor.chainId,
          status: AssignmentStatus.ACTIVE
        },
        include: { areaManager: true }
      }),
      this.prisma.request.findMany({
        where: { createdById: userId, sourceVendorId: vendorId },
        include: workspaceRequestInclude,
        orderBy: { createdAt: "desc" },
        take: 8
      }),
      this.prisma.request.count({
        where: { createdById: userId, sourceVendorId: vendorId }
      }),
      this.prisma.request.count({
        where: {
          createdById: userId,
          sourceVendorId: vendorId,
          status: { in: pendingRequestStatuses }
        }
      })
    ]);

    const branch = this.mapChampBranchAssignment(assignment);

    return {
      ...branch,
      areaManagerAssignment: areaManagerAssignment
        ? {
            id: areaManagerAssignment.id,
            status: areaManagerAssignment.status,
            startDate: areaManagerAssignment.startDate,
            endDate: areaManagerAssignment.endDate
          }
        : null,
      areaManager: areaManagerAssignment
        ? toUserSummary(areaManagerAssignment.areaManager)
        : null,
      recentRequests: recentRequests.map(toRequestSummary),
      recentRequestCount,
      pendingRequestCount
    };
  }

  async getAreaManagerWorkspace(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const assignments = await this.prisma.chainAreaManagerAssignment.findMany({
      where: { areaManagerId: userId, status: AssignmentStatus.ACTIVE },
      include: areaManagerChainInclude,
      orderBy: { createdAt: "desc" }
    });

    const usersById = new Map<string, ReturnType<typeof toUserSummary>>();
    const chains = assignments.map((assignment) => {
      const vendors = assignment.chain.vendors.map((vendor) => {
        const pickers = vendor.pickerAssignments.map((pickerAssignment) => {
          const picker = toUserSummary(pickerAssignment.picker);
          usersById.set(picker.id, picker);

          return {
            assignment: {
              id: pickerAssignment.id,
              status: pickerAssignment.status,
              startDate: pickerAssignment.startDate
            },
            picker
          };
        });
        const champs = vendor.champAssignments.map((champAssignment) => {
          const champ = toUserSummary(champAssignment.champ);
          usersById.set(champ.id, champ);

          return {
            assignment: {
              id: champAssignment.id,
              status: champAssignment.status,
              startDate: champAssignment.startDate
            },
            champ
          };
        });

        return {
          vendor: toVendorSummary(vendor),
          activePickerCount: pickers.length,
          activeChampCount: champs.length,
          pickers,
          champs
        };
      });

      return {
        assignment: {
          id: assignment.id,
          status: assignment.status,
          startDate: assignment.startDate
        },
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
      areaManager: toUserSummary(user),
      chains,
      usersUnderMe: Array.from(usersById.values()),
      totals: {
        chains: chains.length,
        vendors: chains.reduce((total, chain) => total + chain.vendorCount, 0),
        activePickers: chains.reduce(
          (total, chain) => total + chain.activePickerCount,
          0
        ),
        activeChamps: chains.reduce(
          (total, chain) => total + chain.activeChampCount,
          0
        )
      },
      placeholders: {
        requests: "Request visibility is scoped to assigned Chains.",
        approvals: "Approval ownership is derived from active Chain Area Manager assignments."
      }
    };
  }

  async getAdminWorkspace() {
    const [
      chains,
      activeChains,
      vendors,
      activeVendors,
      users,
      activeUsers,
      activePickerAssignments,
      activeChampAssignments,
      activeAreaManagerAssignments,
      recentChains,
      recentVendors,
      recentUsers
    ] = await this.prisma.$transaction([
      this.prisma.chain.count(),
      this.prisma.chain.count({ where: { status: ChainStatus.ACTIVE } }),
      this.prisma.vendor.count(),
      this.prisma.vendor.count({ where: { status: VendorStatus.ACTIVE } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { accountStatus: AccountStatus.ACTIVE } }),
      this.prisma.pickerBranchAssignment.count({
        where: { status: AssignmentStatus.ACTIVE }
      }),
      this.prisma.vendorChampAssignment.count({
        where: { status: AssignmentStatus.ACTIVE }
      }),
      this.prisma.chainAreaManagerAssignment.count({
        where: { status: AssignmentStatus.ACTIVE }
      }),
      this.prisma.chain.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      this.prisma.vendor.findMany({
        include: { chain: true },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

    return {
      totals: {
        chains,
        activeChains,
        vendors,
        activeVendors,
        users,
        activeUsers,
        activePickerAssignments,
        activeChampAssignments,
        activeAreaManagerAssignments
      },
      recent: {
        chains: recentChains.map(toChainSummary),
        vendors: recentVendors.map(toVendorSummary),
        users: recentUsers.map(toUserSummary)
      },
      placeholders: {
        pendingAdminActions:
          "Pending Admin lifecycle actions are available from /admin/pending-actions."
      }
    };
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("Current user was not found.");
    }

    return user;
  }

  private async toChampBranchSummary(
    assignment: ChampBranchAssignment,
    champId: string
  ) {
    const [recentRequestCount, pendingRequestCount] = await this.prisma.$transaction([
      this.prisma.request.count({
        where: { createdById: champId, sourceVendorId: assignment.vendorId }
      }),
      this.prisma.request.count({
        where: {
          createdById: champId,
          sourceVendorId: assignment.vendorId,
          status: { in: pendingRequestStatuses }
        }
      })
    ]);

    return {
      ...this.mapChampBranchAssignment(assignment),
      recentRequestCount,
      pendingRequestCount
    };
  }

  private mapChampBranchAssignment(assignment: ChampBranchAssignment) {
    const pickers = assignment.vendor.pickerAssignments.map((pickerAssignment) => ({
      assignment: {
        id: pickerAssignment.id,
        status: pickerAssignment.status,
        startDate: pickerAssignment.startDate,
        endDate: pickerAssignment.endDate
      },
      picker: toUserSummary(pickerAssignment.picker)
    }));

    return {
      assignment: {
        id: assignment.id,
        status: assignment.status,
        startDate: assignment.startDate,
        endDate: assignment.endDate
      },
      vendor: toVendorSummary(assignment.vendor),
      chain: toChainSummary(assignment.vendor.chain),
      activePickerCount: pickers.length,
      pickers
    };
  }

  private getProfileCompletion(user: User) {
    const missingFields = [
      ["nationalId", user.nationalId],
      ["address", user.address],
      ["dateOfBirth", user.dateOfBirth],
      ["joiningDate", user.joiningDate]
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field);

    return {
      status: user.profileStatus,
      missingFields
    };
  }
}
