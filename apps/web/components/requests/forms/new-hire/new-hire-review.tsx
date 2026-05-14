import { type NewHireTargetRole } from "@/lib/api/requests";
import { type UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { NewHireFormSection } from "./new-hire-section";
import { buildNewHireApprovalSteps, maskNationalId } from "./new-hire-utils";
import { Definition } from "../../shared/request-field";
import { type NewHireChainOption, type NewHireVendorOption } from "../../shared/request-types";
import { formatEnum } from "../../shared/request-utils";

export function NewHireApprovalPreview({
  creatorRole,
  targetRole
}: {
  creatorRole?: UserRole;
  targetRole: NewHireTargetRole;
}) {
  const steps = buildNewHireApprovalSteps(creatorRole, targetRole);

  return (
    <NewHireFormSection
      description="Expected workflow after submission. Backend scope checks remain the source of truth."
      title="Approval path preview"
    >
      <div className="grid gap-2">
        {steps.map((step, index) => (
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-white p-3 text-sm",
              step.skipped ? "border-slate-200 text-slate-500" : "border-orange-100"
            )}
            key={`${step.label}:${index}`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-semibold text-orange-700">
              {index + 1}
            </span>
            <div>
              <p className="font-semibold text-slate-950">
                {step.label}
                {step.skipped ? " (skipped)" : ""}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </NewHireFormSection>
  );
}

export function NewHireReviewCard({
  creatorName,
  mode,
  nationalId,
  phoneNumber,
  selectedChains,
  selectedVendor,
  targetRole
}: {
  creatorName: string;
  mode: "NEW_USER" | "REHIRE";
  nationalId: string;
  phoneNumber: string;
  selectedChains: NewHireChainOption[];
  selectedVendor: NewHireVendorOption | null;
  targetRole: NewHireTargetRole;
}) {
  const expectedNextStep =
    targetRole === "AREA_MANAGER"
      ? "Account and Chain assignment created immediately"
      : targetRole === "PICKER"
        ? "Admin finalization with Shopper ID"
        : "Admin finalization without Shopper ID";

  return (
    <NewHireFormSection
      description="Confirm the request contract before submission."
      title="Review"
    >
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
        <Definition label="Target role" value={formatEnum(targetRole)} />
        <Definition
          label="Mode"
          value={mode === "REHIRE" ? "Rehire" : "New User"}
        />
        <Definition
          label="Selected Chain"
          value={
            targetRole === "AREA_MANAGER"
              ? selectedChains.map((chain) => chain.chainName).join(", ") ||
                "At least one Chain required"
              : selectedVendor?.chain.chainName ?? "Required"
          }
        />
        {targetRole !== "AREA_MANAGER" ? (
          <Definition
            label="Selected Branch"
            value={selectedVendor?.vendorName ?? "Required"}
          />
        ) : null}
        <Definition label="Candidate phone" value={phoneNumber || "Required"} />
        <Definition
          label="National ID"
          value={nationalId ? maskNationalId(nationalId) : "Required"}
        />
        <Definition label="Creator" value={creatorName} />
        <Definition label="Expected next step" value={expectedNextStep} />
      </div>
    </NewHireFormSection>
  );
}
