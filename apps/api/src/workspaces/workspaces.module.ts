import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { OrdersKpisModule } from "../orders-kpis/orders-kpis.module";
import { UsersModule } from "../users/users.module";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  controllers: [WorkspacesController],
  imports: [JwtModule.register({}), OrdersKpisModule, UsersModule],
  providers: [WorkspacesService]
})
export class WorkspacesModule {}
