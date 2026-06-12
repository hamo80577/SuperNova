import { CheckCircle2, ShieldAlert } from "lucide-react";
import { type NewHireLookupCandidate, type NewHireLookupResponse } from "@/lib/api/requests";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../shared/request-empty-state";
import { Definition } from "../../shared/request-field";
import { formatEnum } from "../../shared/request-utils";

export function NewHireLookupResultCard({
  candidate,
  status
}: {
  candidate?: NewHireLookupCandidate;
  status: NewHireLookupResponse["status"];
}) {
  const isRehire = status === "REHIRE_AVAILABLE";
  const roleLabel = candidate?.role ? formatEnum(candidate.role) : "user";
  const title =
    status === "ACTIVE_DUPLICATE"
      ? "Active duplicate found"
      : status === "TEMPORARY_BLOCKED"
        ? "Temporary block is active"
        : status === "PERMANENT_BLOCKED"
          ? "Permanent block is active"
          : isRehire
            ? "Rehire available"
            : "Candidate cannot be submitted";
  const body =
    status === "ACTIVE_DUPLICATE"
      ? "This user already exists and is active. New Hire submission is disabled."
      : status === "TEMPORARY_BLOCKED"
        ? `This ${roleLabel} cannot be rehired until the temporary block expires.`
        : status === "PERMANENT_BLOCKED"
          ? "Admin must remove the permanent block from the user profile before Rehire."
          : isRehire
            ? `SuperNova found a previous ${roleLabel}. Submit this as a Rehire without editing old profile data.`
            : "This candidate cannot be hired right now.";

  return (
    <section
      className={cn(
        "rounded-2xl border p-4 text-sm",
        isRehire
          ? "border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-burgundy)]"
          : "border-[oklch(0.85_0.06_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]"
      )}
    >
      <div className="flex items-start gap-3">
        {isRehire ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--tlb-orange)]" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[oklch(0.55_0.19_27)]" />
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-[color:var(--sn-ink)]">{title}</h3>
          <p className="mt-1 leading-6">{candidate?.reason ?? body}</p>
          {candidate ? (
            <div className="mt-3 grid gap-2 rounded-xl bg-white/75 p-3 text-[color:var(--sn-body)]">
              <Definition label="User" value={candidate.user.nameEn} />
              <Definition label="Role" value={formatEnum(candidate.role)} />
              <Definition label="Status" value={formatEnum(candidate.employmentStatus)} />
              <Definition
                label="National ID"
                value={candidate.maskedNationalId ?? "Masked"}
              />
              <Definition
                label="Last Branch"
                value={candidate.lastBranch?.vendorName ?? "Not available"}
              />
              <Definition
                label="Last Chain"
                value={candidate.lastChain?.chainName ?? "Not available"}
              />
              {candidate.blockReason ? (
                <Definition label="Block reason" value={candidate.blockReason} />
              ) : null}
              {candidate.blockedUntil ? (
                <Definition
                  label="Blocked until"
                  value={new Date(candidate.blockedUntil).toLocaleDateString()}
                />
              ) : null}
              {candidate.remainingDays !== undefined && candidate.remainingDays !== null ? (
                <Definition label="Remaining days" value={String(candidate.remainingDays)} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PreviousUserCard({
  candidate
}: {
  candidate?: NewHireLookupCandidate;
}) {
  if (!candidate) {
    return <EmptyState message="Previous user details are not available." compact />;
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-[#FFD8BD] bg-white p-3 text-sm">
      <Definition label="Name" value={candidate.user.nameEn} />
      <Definition label="Phone" value={candidate.user.phoneNumber} />
      <Definition
        label="National ID"
        value={candidate.maskedNationalId ?? "Masked"}
      />
      <Definition label="Status" value={formatEnum(candidate.employmentStatus)} />
      <Definition
        label="Last Branch"
        value={candidate.lastBranch?.vendorName ?? "Not available"}
      />
      <Definition
        label="Last Chain"
        value={candidate.lastChain?.chainName ?? "Not available"}
      />
    </div>
  );
}
