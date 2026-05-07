import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AccountStatus } from "@prisma/client";

import { UsersService } from "../../users/users.service";
import type { AuthenticatedRequest } from "../types/authenticated-request";
import type { JwtPayload } from "../types/authenticated-user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Authentication is required.");
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>("auth.jwtSecret")
      });
    } catch {
      throw new UnauthorizedException("Authentication token is invalid.");
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException("Authenticated user is not active.");
    }

    request.user = {
      id: user.id,
      role: user.role,
      nameEn: user.nameEn,
      phoneNumber: user.phoneNumber,
      accountStatus: user.accountStatus,
      employmentStatus: user.employmentStatus,
      profileStatus: user.profileStatus,
      mustChangePassword: user.mustChangePassword
    };

    return true;
  }

  private extractToken(request: AuthenticatedRequest) {
    const cookieName = this.configService.getOrThrow<string>("auth.cookieName");
    const cookieToken = request.cookies?.[cookieName];

    if (cookieToken) {
      return cookieToken;
    }

    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
