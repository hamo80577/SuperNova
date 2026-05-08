import { Badge } from "@/components/ui/badge";

export function StatusBadge({
  status
}: {
  status: "ACTIVE" | "INACTIVE" | "CLOSED";
}) {
  return (
    <Badge variant={status === "ACTIVE" ? "default" : "muted"}>
      {status === "ACTIVE" ? "Active" : status === "CLOSED" ? "Closed" : "Inactive"}
    </Badge>
  );
}
