import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { UsersService } from "../../users/users.service";
import { getAccountAccessFailure } from "../account-access.utils";
import type { AuthenticatedRequest } from "../types/authenticated-request";
import type { JwtPayload } from "../types/authenticated-user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(UsersService)
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

    if (!user) {
      throw new UnauthorizedException("User account is not active.");
    }

    const accessFailure = getAccountAccessFailure(user);
    if (accessFailure) {
      throw new UnauthorizedException(accessFailure);
    }

    request.user = {
      id: user.id,
      role: user.role,
      nameEn: user.nameEn,
      phoneNumber: user.phoneNumber,
      nationalId: user.nationalId,
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
