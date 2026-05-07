import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  return (
    <Badge variant={status === "ACTIVE" ? "default" : "muted"}>
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </Badge>
  );
}
