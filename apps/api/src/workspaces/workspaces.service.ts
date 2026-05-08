import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AccountStatus,
  AssignmentStatus,
  ChainStatus,
  Prisma,
  User,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";
import { PrismaService } from "../prisma/prisma.service";
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
        where: { status: AssignmentStatus.ACTIVE },
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
            where: { status: AssignmentStatus.ACTIVE },
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
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { champId: userId, status: AssignmentStatus.ACTIVE },
      include: champBranchInclude,
      orderBy: { createdAt: "desc" }
    });

    const branches = assignments.map((assignment) => {
      const pickers = assignment.vendor.pickerAssignments.map((pickerAssignment) => ({
        assignment: {
          id: pickerAssignment.id,
          status: pickerAssignment.status,
          startDate: pickerAssignment.startDate
        },
        picker: toUserSummary(pickerAssignment.picker)
      }));

      return {
        assignment: {
          id: assignment.id,
          status: assignment.status,
          startDate: assignment.startDate
        },
        vendor: toVendorSummary(assignment.vendor),
        chain: toChainSummary(assignment.vendor.chain),
        activePickerCount: pickers.length,
        pickers
      };
    });

    return {
      champ: toUserSummary(user),
      branches,
      totals: {
        branches: branches.length,
        activePickers: branches.reduce(
          (total, branch) => total + branch.activePickerCount,
          0
        )
      },
      placeholders: {
        requests: "Request workflows are not implemented in Phase 4.",
        actions: "Lifecycle actions remain request-based in later phases."
      }
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
        requests: "Request and approval queues are not implemented in Phase 4.",
        approvals: "Approval ownership remains a later workflow phase."
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
          "Pending admin lifecycle actions start after request workflows are implemented."
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
