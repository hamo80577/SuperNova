-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_action_createdAt_idx" ON "AuditLog"("entityType", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PickerBranchAssignment_createdByRequestId_idx" ON "PickerBranchAssignment"("createdByRequestId");

-- CreateIndex
CREATE INDEX "Request_status_currentStep_idx" ON "Request"("status", "currentStep");

-- CreateIndex
CREATE INDEX "Request_type_status_idx" ON "Request"("type", "status");

-- CreateIndex
CREATE INDEX "Request_sourceChainId_status_idx" ON "Request"("sourceChainId", "status");

-- CreateIndex
CREATE INDEX "Request_destinationChainId_status_idx" ON "Request"("destinationChainId", "status");

-- CreateIndex
CREATE INDEX "Request_createdAt_idx" ON "Request"("createdAt");

-- CreateIndex
CREATE INDEX "RequestApproval_approverId_status_step_idx" ON "RequestApproval"("approverId", "status", "step");

-- CreateIndex
CREATE INDEX "RequestApproval_status_step_idx" ON "RequestApproval"("status", "step");

-- CreateIndex
CREATE INDEX "RequestApproval_requestId_status_idx" ON "RequestApproval"("requestId", "status");

-- CreateIndex
CREATE INDEX "User_role_accountStatus_idx" ON "User"("role", "accountStatus");

-- CreateIndex
CREATE INDEX "User_role_employmentStatus_idx" ON "User"("role", "employmentStatus");

-- CreateIndex
CREATE INDEX "User_role_profileStatus_idx" ON "User"("role", "profileStatus");
