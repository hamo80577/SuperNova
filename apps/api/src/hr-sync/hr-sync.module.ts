import { Module } from "@nestjs/common";

import { HrSyncService } from "./hr-sync.service";

@Module({
  providers: [HrSyncService],
  exports: [HrSyncService]
})
export class HrSyncModule {}
