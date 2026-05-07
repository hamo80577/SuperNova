import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AccountStatus, User, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Response } from "express";
import type { StringValue } from "ms";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { toSafeUser } from "../users/dto/safe-user.dto";
import { UsersService } from "../users/users.service";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { LoginDto } from "./dto/login.dto";
import type { AuthenticatedUser, JwtPayload } from "./types/authenticated-user";

const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService
  ) {}

  getFoundationStatus() {
    return {
      module: "auth",
      status: "active",
      note: "Phase 1 cookie JWT authentication is enabled."
    };
  }

  async login(
    loginDto: LoginDto,
    context: {
      response: Response;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const phoneNumber = loginDto.phoneNumber.trim();
    const user = await this.usersService.findByPhoneNumber(phoneNumber);

    if (!user) {
      await this.logFailedLogin(phoneNumber, context);
      throw new UnauthorizedException("Invalid phone number or password.");
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      await this.logFailedLogin(phoneNumber, context, user.id);
      throw new UnauthorizedException("User account is not active.");
    }

    if (this.hasExpiredTemporaryPassword(user)) {
      await this.logFailedLogin(phoneNumber, context, user.id);
      throw new UnauthorizedException("Temporary password has expired.");
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      await this.logFailedLogin(phoneNumber, context, user.id);
      throw new UnauthorizedException("Invalid phone number or password.");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = await this.signToken(updatedUser);
    this.setAuthCookie(context.response, token);

    await this.auditService.log({
      actorUserId: updatedUser.id,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: updatedUser.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      user: toSafeUser(updatedUser),
      redirectTo: this.getRoleRedirect(
        updatedUser.role,
        updatedUser.mustChangePassword
      ),
      mustChangePassword: updatedUser.mustChangePassword
    };
  }

  async logout(
    user: AuthenticatedUser,
    context: {
      response: Response;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    this.clearAuthCookie(context.response);

    await this.auditService.log({
      actorUserId: user.id,
      action: "LOGOUT",
      entityType: "User",
      entityId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return { success: true };
  }

  async changePassword(
    currentUser: AuthenticatedUser,
    changePasswordDto: ChangePasswordDto,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    if (changePasswordDto.currentPassword === changePasswordDto.newPassword) {
      throw new BadRequestException(
        "New password must differ from the current password."
      );
    }

    const user = await this.usersService.findById(currentUser.id);

    if (!user) {
      throw new NotFoundException("Current user was not found.");
    }

    if (this.hasExpiredTemporaryPassword(user)) {
      throw new UnauthorizedException("Temporary password has expired.");
    }

    const currentPasswordMatches = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash
    );

    if (!currentPasswordMatches) {
      throw new UnauthorizedException("Current password is invalid.");
    }

    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      PASSWORD_HASH_ROUNDS
    );

    const action = user.mustChangePassword
      ? "FORCED_PASSWORD_CHANGED"
      : "PASSWORD_CHANGED";

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        lastLoginAt: new Date()
      }
    });

    await this.auditService.log({
      actorUserId: updatedUser.id,
      action,
      entityType: "User",
      entityId: updatedUser.id,
      oldValue: {
        mustChangePassword: user.mustChangePassword,
        temporaryPasswordExpiresAt:
          user.temporaryPasswordExpiresAt?.toISOString() ?? null
      },
      newValue: {
        mustChangePassword: updatedUser.mustChangePassword,
        temporaryPasswordExpiresAt: null
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      user: toSafeUser(updatedUser),
      redirectTo: this.getRoleRedirect(
        updatedUser.role,
        updatedUser.mustChangePassword
      ),
      mustChangePassword: updatedUser.mustChangePassword
    };
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException("Current user was not found.");
    }

    return {
      user: toSafeUser(user),
      redirectTo: this.getRoleRedirect(user.role, user.mustChangePassword),
      mustChangePassword: user.mustChangePassword
    };
  }

  getRoleRedirect(role: UserRole, mustChangePassword = false) {
    if (mustChangePassword) {
      return "/change-password";
    }

    const redirects: Record<UserRole, string> = {
      PICKER: "/picker/dashboard",
      CHAMP: "/champ/dashboard",
      AREA_MANAGER: "/area-manager/dashboard",
      ADMIN: "/admin/dashboard",
      SUPER_ADMIN: "/admin/dashboard"
    };

    return redirects[role];
  }

  private async signToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role
    };

    const expiresIn = this.configService.getOrThrow<StringValue>(
      "auth.jwtExpiresIn"
    );

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("auth.jwtSecret"),
      expiresIn
    });
  }

  private setAuthCookie(response: Response, token: string) {
    response.cookie(
      this.configService.getOrThrow<string>("auth.cookieName"),
      token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: this.configService.get<boolean>("auth.isProduction") ?? false,
        path: "/"
      }
    );
  }

  private clearAuthCookie(response: Response) {
    response.clearCookie(
      this.configService.getOrThrow<string>("auth.cookieName"),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: this.configService.get<boolean>("auth.isProduction") ?? false,
        path: "/"
      }
    );
  }

  private hasExpiredTemporaryPassword(user: User) {
    if (!user.mustChangePassword || !user.temporaryPasswordExpiresAt) {
      return false;
    }

    return user.temporaryPasswordExpiresAt.getTime() <= Date.now();
  }

  private async logFailedLogin(
    phoneNumber: string,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
    userId?: string
  ) {
    await this.auditService.log({
      actorUserId: userId ?? null,
      action: "LOGIN_FAILED",
      entityType: userId ? "User" : "Auth",
      entityId: userId ?? phoneNumber,
      newValue: {
        phoneNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}
