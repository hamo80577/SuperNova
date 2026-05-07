import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import type { Response } from "express";

import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "./types/authenticated-request";
import type { AuthenticatedUser } from "./types/authenticated-user";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("status")
  getStatus() {
    return this.authService.getFoundationStatus();
  }

  @Post("login")
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    return this.authService.login(loginDto, {
      response,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    return this.authService.logout(user, {
      response,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.authService.changePassword(user, changePasswordDto, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }
}
