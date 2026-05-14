import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type RequestStatus } from "@/lib/api/requests";
import { formatEnum } from "./request-utils";

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const variant = status === "APPROVED" ? "default" : "muted";
  const Icon =
    status === "APPROVED"
      ? CheckCircle2
      : status === "REJECTED" || status === "CANCELLED"
        ? XCircle
        : status === "DRAFT"
          ? FileText
          : Clock;

  return (
    <Badge className="gap-1" variant={variant}>
      <Icon className="h-3 w-3" />
      {formatEnum(status)}
    </Badge>
  );
}

export function ApprovalStatusBadge({ status }: { status: string }) {
  return <Badge variant={status === "APPROVED" ? "default" : "muted"}>{formatEnum(status)}</Badge>;
}
