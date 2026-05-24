import { Inject, Injectable } from "@nestjs/common";
import {
  AttendanceMatchKeyType,
  AttendanceMatchedRole,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type {
  AttendanceMatchedUser,
  AttendanceMatchResult
} from "./attendance.types";

@Injectable()
export class AttendanceMatcherService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async matchIdentifier(identifier: string): Promise<AttendanceMatchResult> {
    const results = await this.matchIdentifiers([identifier]);
    return results.get(identifier.trim()) ?? unmatched();
  }

  async matchIdentifiers(identifiers: string[]) {
    const normalizedIdentifiers = Array.from(
      new Set(identifiers.map((identifier) => identifier.trim()).filter(Boolean))
    );
    const results = new Map<string, AttendanceMatchResult>();

    normalizedIdentifiers.forEach((identifier) => {
      results.set(identifier, unmatched());
    });

    if (!normalizedIdentifiers.length) {
      return results;
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { shopperId: { in: normalizedIdentifiers } },
          { ibsId: { in: normalizedIdentifiers } }
        ]
      },
      select: {
        id: true,
        role: true,
        shopperId: true,
        ibsId: true,
        joiningDate: true
      }
    });

    normalizedIdentifiers.forEach((identifier) => {
      results.set(identifier, this.resolveIdentifierMatch(identifier, users));
    });

    return results;
  }

  private resolveIdentifierMatch(
    identifier: string,
    users: AttendanceMatchedUser[]
  ): AttendanceMatchResult {
    const candidates = users.filter(
      (user) => user.shopperId === identifier || user.ibsId === identifier
    );

    if (!candidates.length) {
      return unmatched();
    }

    const supported = candidates
      .map((user) => toSupportedMatch(identifier, user))
      .filter((match): match is AttendanceMatchResult => match !== null);

    if (supported.length === 1) {
      return supported[0];
    }

    if (supported.length > 1) {
      return {
        outcome: "AMBIGUOUS_IDENTIFIER_MATCH",
        user: null,
        matchedRole: null,
        matchKeyType: null
      };
    }

    return {
      outcome: "UNSUPPORTED_ROLE",
      user: candidates[0],
      matchedRole: null,
      matchKeyType: null
    };
  }
}

function toSupportedMatch(
  identifier: string,
  user: AttendanceMatchedUser
): AttendanceMatchResult | null {
  if (user.role === UserRole.PICKER && user.shopperId === identifier) {
    return {
      outcome: "MATCHED_PICKER",
      user,
      matchedRole: AttendanceMatchedRole.PICKER,
      matchKeyType: AttendanceMatchKeyType.SHOPPER_ID
    };
  }

  if (user.role === UserRole.CHAMP && user.ibsId === identifier) {
    return {
      outcome: "MATCHED_CHAMP",
      user,
      matchedRole: AttendanceMatchedRole.CHAMP,
      matchKeyType: AttendanceMatchKeyType.IBS_ID
    };
  }

  return null;
}

function unmatched(): AttendanceMatchResult {
  return {
    outcome: "UNMATCHED_IDENTIFIER",
    user: null,
    matchedRole: null,
    matchKeyType: null
  };
}

