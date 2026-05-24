"use client";

import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  Inbox,
  Search,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import {
  reportsApi,
  type AttendanceBranchSummary,
  type AttendanceChainSummary,
  type AttendanceMatchedRole,
  type AttendanceOverview,
  type AttendanceReportMonth,
  type AttendanceUserDailyDetails,
  type AttendanceUserSummary
} from "@/lib/api/reports";

type AsyncState = "idle" | "loading" | "ready" | "error";
type UserRoleFilter = "ALL" | AttendanceMatchedRole;
type AttendanceReportScope = "admin" | "area-manager" | "champ";

const currentMonthKey = new Date().toISOString().slice(0, 7);

export function AttendanceReportPage({
  scope = "admin"
}: {
  scope?: AttendanceReportScope;
}) {
  const reportApi = useMemo(() => getAttendanceReportApi(scope), [scope]);
  const reportCopy = attendanceReportCopy[scope];
  const [months, setMonths] = useState<AttendanceReportMonth[]>([]);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [chainId, setChainId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("ALL");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AsyncState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [chains, setChains] = useState<AttendanceChainSummary[]>([]);
  const [branches, setBranches] = useState<AttendanceBranchSummary[]>([]);
  const [users, setUsers] = useState<AttendanceUserSummary[]>([]);
  const [selectedUser, setSelectedUser] =
    useState<AttendanceUserSummary | null>(null);
  const [dailyDetails, setDailyDetails] =
    useState<AttendanceUserDailyDetails | null>(null);
  const [dailyStatus, setDailyStatus] = useState<AsyncState>("idle");
  const [dailyError, setDailyError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadMonths() {
      try {
        const response = await reportApi.months();
        if (!mounted) {
          return;
        }

        setMonths(response.items);
        if (response.items.length) {
          setMonthKey(response.items[0].monthKey);
        }
      } catch (loadError) {
        if (mounted) {
          setError(getErrorMessage(loadError, "Unable to load report months."));
        }
      }
    }

    void loadMonths();
    return () => {
      mounted = false;
    };
  }, [reportApi]);

  useEffect(() => {
    let mounted = true;

    async function loadReports() {
      setStatus("loading");
      setError(null);

      try {
        const userRole =
          roleFilter === "ALL" ? undefined : (roleFilter as AttendanceMatchedRole);
        const [overviewData, chainData, branchData, userData] =
          await Promise.all([
            reportApi.overview({ chainId, monthKey, vendorId }),
            reportApi.chainSummaries
              ? reportApi.chainSummaries({ monthKey })
              : Promise.resolve({ items: [], monthKey }),
            reportApi.branchSummaries({ chainId, monthKey, vendorId }),
            reportApi.userSummaries({
              chainId,
              monthKey,
              pageSize: 100,
              role: userRole,
              search,
              vendorId
            })
          ]);

        if (!mounted) {
          return;
        }

        setOverview(overviewData);
        setChains(chainData.items);
        setBranches(branchData.items);
        setUsers(userData.items);
        setStatus("ready");
      } catch (loadError) {
        if (mounted) {
          setStatus("error");
          setError(
            getErrorMessage(loadError, "Unable to load attendance reports.")
          );
        }
      }
    }

    void loadReports();
    return () => {
      mounted = false;
    };
  }, [chainId, monthKey, reportApi, roleFilter, search, vendorId]);

  const chainOptions = useMemo(
    () =>
      chains.map((chain) => ({
        label: chain.chainName,
        value: chain.chainId
      })),
    [chains]
  );
  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        label: branch.vendorName,
        value: branch.vendorId
      })),
    [branches]
  );
  const pickerUsers = users.filter((user) => user.role === "PICKER");
  const champUsers = users.filter((user) => user.role === "CHAMP");

  async function openUserDetails(user: AttendanceUserSummary) {
    setSelectedUser(user);
    setDailyDetails(null);
    setDailyStatus("loading");
    setDailyError(null);

    try {
      const details = await reportApi.userDailyDetails(user.userId, monthKey);
      setDailyDetails(details);
      setDailyStatus("ready");
    } catch (loadError) {
      setDailyStatus("error");
      setDailyError(
        getErrorMessage(loadError, "Unable to load daily attendance details.")
      );
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(150px,190px)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,190px)_minmax(180px,1.1fr)]">
          <Field label="Month">
            <Select
              aria-label="Attendance report month"
              onChange={(event) => setMonthKey(event.target.value)}
              value={monthKey}
            >
              {months.length ? (
                months.map((month) => (
                  <option key={month.monthKey} value={month.monthKey}>
                    {formatMonth(month.monthKey)}
                  </option>
                ))
              ) : (
                <option value={monthKey}>{formatMonth(monthKey)}</option>
              )}
            </Select>
          </Field>
          {reportCopy.showChainFilter ? (
            <Field label="Chain">
              <Select
                aria-label="Filter by Chain"
                onChange={(event) => {
                  setChainId(event.target.value);
                  setVendorId("");
                }}
                value={chainId}
              >
                <option value="">All Chains</option>
                {chainOptions.map((chain) => (
                  <option key={chain.value} value={chain.value}>
                    {chain.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Branch">
            <Select
              aria-label="Filter by Branch"
              onChange={(event) => setVendorId(event.target.value)}
              value={vendorId}
            >
              <option value="">All Branches</option>
              {branchOptions.map((branch) => (
                <option key={branch.value} value={branch.value}>
                  {branch.label}
                </option>
              ))}
            </Select>
          </Field>
          {reportCopy.showRoleFilter ? (
            <Field label="Users">
              <Select
                aria-label="Filter users by role"
                onChange={(event) =>
                  setRoleFilter(event.target.value as UserRoleFilter)
                }
                value={roleFilter}
              >
                <option value="ALL">All roles</option>
                <option value="PICKER">Pickers</option>
                <option value="CHAMP">Champs</option>
              </Select>
            </Field>
          ) : null}
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search attendance users"
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or identifier"
                value={search}
              />
            </div>
          </Field>
        </div>
      </section>

      {status === "error" ? <ErrorPanel message={error} /> : null}
      {status === "loading" ? <LoadingPanel /> : null}

      {status === "ready" && overview ? (
        <>
          <OverviewSection overview={overview} />
          {overview.summaryOnly || !overview.dailyRecordsAvailable ? (
            <Notice>
              Daily detail is no longer stored for this month. Monthly summary
              is available.
            </Notice>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <ReportSection
              description={reportCopy.pickerSectionDescription}
              title={reportCopy.pickerSectionTitle}
            >
              {reportCopy.showChainSummary ? (
                <SummaryTable
                  columns={[
                    "Chain",
                    "Branches",
                    "Pickers",
                    "Created",
                    "Needed",
                    "Missing",
                    "Absent",
                    "Late >15",
                    "Under 8",
                    "Over 15"
                  ]}
                  emptyMessage="No Chain attendance summaries for this month."
                  rows={chains.map((chain) => ({
                    cells: [
                      chain.chainName,
                      chain.branchCount,
                      chain.pickerCount,
                      chain.totalCreatedShifts,
                      chain.totalShiftsNeeded,
                      chain.missingShifts,
                      chain.absentCount,
                      chain.lateLevel1Over15Count,
                      chain.under8HoursCount,
                      chain.over15HoursCount
                    ],
                    title: chain.chainName
                  }))}
                  title="Chain Summary"
                />
              ) : null}
              <SummaryTable
                columns={[
                  "Branch",
                  "Chain",
                  "Pickers",
                  "Created",
                  "Needed",
                  "Missing",
                  "Absent",
                  "Late >15",
                  "Under 8",
                  "Over 15"
                ]}
                emptyMessage="No Branch attendance summaries for this month."
                rows={branches.map((branch) => ({
                  cells: [
                    branch.vendorName,
                    branch.chainName,
                    branch.pickerCount,
                    branch.totalCreatedShifts,
                    branch.totalShiftsNeeded,
                    branch.missingShifts,
                    branch.absentCount,
                    branch.lateLevel1Over15Count,
                    branch.under8HoursCount,
                    branch.over15HoursCount
                  ],
                  title: branch.vendorName
                }))}
                title="Branch Summary"
              />
              {roleFilter !== "CHAMP" ? (
                <UserSummaryList
                  emptyMessage="No Picker user summaries match these filters."
                  onSelect={openUserDetails}
                  title="Picker User Summaries"
                  users={pickerUsers}
                />
              ) : null}
            </ReportSection>

            {reportCopy.showChampSection ? (
              <ReportSection
                description="Champ attendance is user-level only and is not included in Branch or Chain totals."
                title="Champ Attendance"
              >
                {roleFilter !== "PICKER" ? (
                  <UserSummaryList
                    emptyMessage="No Champ summaries match these filters."
                    onSelect={openUserDetails}
                    title="Champ User Summaries"
                    users={champUsers}
                  />
                ) : (
                  <EmptyState message="User role filter is set to Pickers." />
                )}
              </ReportSection>
            ) : null}
          </section>
        </>
      ) : null}

      {selectedUser ? (
        <UserAttendanceModal
          details={dailyDetails}
          error={dailyError}
          onClose={() => {
            setSelectedUser(null);
            setDailyDetails(null);
          }}
          status={dailyStatus}
          user={selectedUser}
        />
      ) : null}
    </div>
  );
}

function OverviewSection({ overview }: { overview: AttendanceOverview }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Pickers" value={overview.totalPickers} />
      <MetricCard label="Champs" value={overview.totalChamps} />
      <MetricCard label="Created shifts" value={overview.totalCreatedShifts} />
      <MetricCard label="Needed shifts" value={overview.totalShiftsNeeded} />
      <MetricCard label="Missing shifts" value={overview.totalMissingShifts} />
      <MetricCard label="Absences" value={overview.absentCount} />
      <MetricCard label="Late >15" value={overview.lateLevel1Over15Count} />
      <MetricCard label="Under 8h" value={overview.under8HoursCount} />
      <MetricCard label="Over 15h" value={overview.over15HoursCount} />
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Archive
          </span>
          <Badge variant={overview.summaryOnly ? "outline" : "default"}>
            {formatEnum(overview.archiveStatus)}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {overview.branchCount} Branches / {overview.chainCount} Chains
        </p>
      </section>
    </section>
  );
}

function Field({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </section>
  );
}

function ReportSection({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid content-start gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SummaryTable({
  columns,
  emptyMessage,
  rows,
  title
}: {
  columns: string[];
  emptyMessage: string;
  rows: Array<{ cells: Array<number | string>; title: string }>;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      {rows.length ? (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  {columns.map((column) => (
                    <th className="py-3 pr-4" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-b last:border-0" key={row.title}>
                    {row.cells.map((cell, index) => (
                      <td className="py-3 pr-4" key={`${row.title}-${index}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 md:hidden">
            {rows.map((row) => (
              <div className="rounded-lg border bg-background p-3" key={row.title}>
                <p className="font-medium">{row.title}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {columns.slice(1).map((column, index) => (
                    <Definition
                      key={`${row.title}-${column}`}
                      label={column}
                      value={row.cells[index + 1]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </section>
  );
}

function UserSummaryList({
  emptyMessage,
  onSelect,
  title,
  users
}: {
  emptyMessage: string;
  onSelect: (user: AttendanceUserSummary) => void;
  title: string;
  users: AttendanceUserSummary[];
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      {users.length ? (
        <div className="mt-4 grid gap-2">
          {users.map((user) => (
            <button
              className="grid min-h-20 gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:grid-cols-[minmax(160px,1.3fr)_repeat(5,minmax(70px,0.5fr))_auto]"
              key={user.id}
              onClick={() => onSelect(user)}
              type="button"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{user.displayName}</p>
                  <Badge variant="outline">{user.role}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {user.identifier}
                  {user.branch ? ` / ${user.branch.vendorName}` : ""}
                  {user.chain ? ` / ${user.chain.chainName}` : ""}
                </p>
              </div>
              <MiniMetric label="Created" value={user.totalCreatedShifts} />
              <MiniMetric label="Needed" value={user.totalShiftsNeeded} />
              <MiniMetric label="Missing" value={user.missingShifts} />
              <MiniMetric label="Late >15" value={user.lateLevel1Over15Count} />
              <MiniMetric label="Absent" value={user.absentCount} />
              <ChevronRight className="hidden h-5 w-5 self-center text-muted-foreground sm:block" />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function UserAttendanceModal({
  details,
  error,
  onClose,
  status,
  user
}: {
  details: AttendanceUserDailyDetails | null;
  error: string | null;
  onClose: () => void;
  status: AsyncState;
  user: AttendanceUserSummary;
}) {
  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[120] grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4"
        role="dialog"
      >
        <section className="max-h-[92dvh] w-full overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:max-w-4xl sm:rounded-2xl">
          <header className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                Read-only attendance details
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold">
                {user.displayName}
              </h2>
            </div>
            <Button
              aria-label="Close attendance details"
              className="h-11 w-11 shrink-0 rounded-xl p-0"
              onClick={onClose}
              type="button"
              variant="ghost"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>
          <div className="max-h-[calc(92dvh-86px)] overflow-y-auto p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <MetricCard label="Created" value={user.totalCreatedShifts} />
              <MetricCard label="Needed" value={user.totalShiftsNeeded} />
              <MetricCard label="Missing" value={user.missingShifts} />
              <MetricCard label="Late >15" value={user.lateLevel1Over15Count} />
            </div>

            {status === "loading" ? (
              <LoadingPanel compact />
            ) : status === "error" ? (
              <ErrorPanel message={error} />
            ) : details?.dailyRecordsAvailable ? (
              <div className="mt-5 grid gap-3">
                <h3 className="text-base font-semibold">Daily Detail</h3>
                {details.records.map((record) => (
                  <article
                    className="rounded-lg border bg-background p-3"
                    key={`${record.attendanceDate}-${record.shiftName ?? "shift"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {formatDate(record.attendanceDate)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.shiftName ?? "Shift"}
                        </p>
                      </div>
                      <Badge variant="outline">{formatEnum(record.status)}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <Definition label="Late mins" value={record.lateMinutes} />
                      <Definition
                        label="Work hours"
                        value={record.actualWorkDurationHours ?? "-"}
                      />
                      <Definition
                        label="Check-in"
                        value={formatTime(record.actualCheckInAt)}
                      />
                      <Definition
                        label="Check-out"
                        value={formatTime(record.actualCheckOutAt)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Notice>{details?.message ?? "Daily details unavailable."}</Notice>
            )}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

function Definition({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/45 px-2.5 py-2">
      <p className="truncate text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 grid place-items-center rounded-lg border bg-background p-6 text-center">
      <Inbox className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ErrorPanel({ message }: { message: string | null }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message ?? "Unable to load attendance reports."}
    </div>
  );
}

function LoadingPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-busy="true"
      className={compact ? "mt-5 rounded-lg border p-4" : "rounded-lg border p-5"}
      role="status"
    >
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Clock3 className="h-4 w-4 animate-pulse" />
        Loading attendance report data...
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/35 p-4 text-sm text-muted-foreground">
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

type AttendanceReportApi = {
  branchSummaries: typeof reportsApi.getAttendanceBranchSummaries;
  chainSummaries?: typeof reportsApi.getAttendanceChainSummaries;
  months: typeof reportsApi.getAttendanceReportMonths;
  overview: typeof reportsApi.getAttendanceOverview;
  userDailyDetails: typeof reportsApi.getAttendanceUserDailyDetails;
  userSummaries: typeof reportsApi.getAttendanceUserSummaries;
};

const attendanceReportCopy: Record<
  AttendanceReportScope,
  {
    pickerSectionDescription: string;
    pickerSectionTitle: string;
    showChainFilter: boolean;
    showChainSummary: boolean;
    showChampSection: boolean;
    showRoleFilter: boolean;
  }
> = {
  admin: {
    pickerSectionDescription: "Branch and Chain totals include Pickers only.",
    pickerSectionTitle: "Picker Operations",
    showChainFilter: true,
    showChainSummary: true,
    showChampSection: true,
    showRoleFilter: true
  },
  "area-manager": {
    pickerSectionDescription:
      "Scoped to your active assigned Chains. Branch and Chain totals include Pickers only.",
    pickerSectionTitle: "Picker Operations",
    showChainFilter: true,
    showChainSummary: true,
    showChampSection: true,
    showRoleFilter: true
  },
  champ: {
    pickerSectionDescription:
      "Scoped to your active assigned Branches. Branch totals include Pickers only.",
    pickerSectionTitle: "Assigned Branches",
    showChainFilter: false,
    showChainSummary: false,
    showChampSection: false,
    showRoleFilter: false
  }
};

function getAttendanceReportApi(scope: AttendanceReportScope): AttendanceReportApi {
  if (scope === "area-manager") {
    return {
      branchSummaries: reportsApi.getAreaManagerAttendanceBranchSummaries,
      chainSummaries: reportsApi.getAreaManagerAttendanceChainSummaries,
      months: reportsApi.getAreaManagerAttendanceMonths,
      overview: reportsApi.getAreaManagerAttendanceOverview,
      userDailyDetails: reportsApi.getAreaManagerAttendanceUserDailyDetails,
      userSummaries: reportsApi.getAreaManagerAttendanceUserSummaries
    };
  }

  if (scope === "champ") {
    return {
      branchSummaries: reportsApi.getChampAttendanceBranchSummaries,
      months: reportsApi.getChampAttendanceMonths,
      overview: reportsApi.getChampAttendanceOverview,
      userDailyDetails: reportsApi.getChampAttendanceUserDailyDetails,
      userSummaries: reportsApi.getChampAttendanceUserSummaries
    };
  }

  return {
    branchSummaries: reportsApi.getAttendanceBranchSummaries,
    chainSummaries: reportsApi.getAttendanceChainSummaries,
    months: reportsApi.getAttendanceReportMonths,
    overview: reportsApi.getAttendanceOverview,
    userDailyDetails: reportsApi.getAttendanceUserDailyDetails,
    userSummaries: reportsApi.getAttendanceUserSummaries
  };
}

function formatMonth(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00.000Z`).toLocaleDateString(
    undefined,
    {
      month: "long",
      timeZone: "UTC",
      year: "numeric"
    }
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
