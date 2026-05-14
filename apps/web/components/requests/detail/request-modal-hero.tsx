import { type RequestDetail } from "@/lib/api/requests";
import { RequestStatusBadge } from "../shared/request-badges";
import { getRequestIcon, getRequestPrimaryContext } from "../shared/request-utils";

export function RequestModalHero({ request }: { request: RequestDetail }) {
  const context = getRequestPrimaryContext(request);
  const Icon = getRequestIcon(request.type);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-700">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {context.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{context.subtitle}</p>
            <p className="mt-2 text-xs text-slate-500">
              Submitted by {request.createdBy.nameEn} ·{" "}
              {new Date(request.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
    </section>
  );
}
