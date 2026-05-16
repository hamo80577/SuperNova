"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  IdCard,
  MapPin,
  UserRound
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DetailPanelSkeleton,
  PageHeaderSkeleton
} from "@/components/ui/skeleton";
import {
  usersApi,
  type ProfileCompletionResponse
} from "@/lib/api/users";
import { replaceRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const steps = [
  "Personal Info",
  "Identity Info",
  "Contact Info",
  "Final Review"
] as const;

const profileCompletionSchema = z
  .object({
    nameEn: z.string().trim().max(120).optional(),
    nameAr: z.string().trim().max(120).optional(),
    nationalId: z
      .string()
      .trim()
      .min(4, "National ID is required.")
      .max(40),
    dateOfBirth: z.string().min(1, "Date of birth is required."),
    gender: z.enum(["MALE", "FEMALE", "UNSPECIFIED"]),
    address: z.string().trim().min(5, "Address is required.").max(500),
    joiningDate: z.string().min(1, "Joining date is required.")
  })
  .refine((value) => Boolean(value.nameEn || value.nameAr), {
    message: "English or Arabic name is required.",
    path: ["nameEn"]
  });

type ProfileCompletionFormValues = z.infer<typeof profileCompletionSchema>;

export function PickerProfileCompletion() {
  const [state, setState] = useState<AsyncState<ProfileCompletionResponse>>({
    status: "loading"
  });
  const [activeStep, setActiveStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { refresh, user } = useAuth();
  const router = useRouter();

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch
  } = useForm<ProfileCompletionFormValues>({
    resolver: zodResolver(profileCompletionSchema),
    defaultValues: {
      gender: "UNSPECIFIED"
    }
  });

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const response = await usersApi.profileCompletion();
        if (!mounted) {
          return;
        }

        if (response.user.profileStatus === "COMPLETE") {
          replaceRoute(router, "/picker/dashboard");
          return;
        }

        setState({ status: "ready", data: response });
        reset({
          nameEn: response.user.nameEn ?? "",
          nameAr: response.user.nameAr ?? "",
          nationalId: response.user.nationalId ?? "",
          dateOfBirth: toDateInput(response.user.dateOfBirth),
          gender: response.user.gender,
          address: response.user.address ?? "",
          joiningDate: toDateInput(response.user.joiningDate)
        });
      } catch (caughtError) {
        if (mounted) {
          setState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load profile completion."
          });
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [reset, router]);

  function onSubmit(values: ProfileCompletionFormValues) {
    startTransition(async () => {
      setSubmitError(null);
      try {
        await usersApi.updateProfileCompletion(cleanOptional(values));
        await refresh();
        setSubmitted(true);
        replaceRoute(router, "/picker/dashboard");
      } catch (caughtError) {
        setSubmitError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit profile completion."
        );
      }
    });
  }

  if (state.status === "loading") {
    return <LoadingState label="Loading profile completion" />;
  }

  if (state.status === "error") {
    return <ErrorState message={state.error} />;
  }

  const values = watch();
  const missingFields = state.data.profileCompletion.missingFields;
  const completionCount = state.data.profileCompletion.requiredFields.length - missingFields.length;
  const progress = Math.round(
    (completionCount / state.data.profileCompletion.requiredFields.length) * 100
  );

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">Operational onboarding</Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Complete Picker Profile
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Complete your operational profile so your Branch, Champ, and Area
              Manager context stays accurate. Password setup stays separate and
              always happens first.
            </p>
          </div>
          <Badge variant={missingFields.length ? "muted" : "default"}>
            {progress}% ready
          </Badge>
        </div>

        <div className="mt-5 h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {missingFields.length ? (
            missingFields.map((field) => (
              <Badge key={field} variant="outline">
                Missing {formatField(field)}
              </Badge>
            ))
          ) : (
            <Badge variant="default">Required fields are ready</Badge>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-2">
            {steps.map((step, index) => (
              <button
                className={cn(
                  "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition",
                  activeStep === index
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
                key={step}
                onClick={() => setActiveStep(index)}
                type="button"
              >
                <span>{step}</span>
                {activeStep === index ? <BadgeCheck className="h-4 w-4" /> : null}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-md border bg-background p-3">
            <p className="text-sm font-medium">Current account</p>
            <p className="mt-1 text-sm text-muted-foreground">{user?.phoneNumber}</p>
            <Badge className="mt-3" variant="muted">
              {state.data.user.profileStatus}
            </Badge>
          </div>
        </aside>

        <form
          className="rounded-lg border bg-card p-5 shadow-sm"
          onSubmit={handleSubmit(onSubmit)}
        >
          {activeStep === 0 ? (
            <StepSection
              description="Confirm your display names and gender for operational workspace visibility."
              icon={<UserRound className="h-5 w-5 text-primary" />}
              title="Personal Info"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field error={errors.nameEn?.message} label="Name in English">
                  <Input placeholder="Example: Ahmed Hassan" {...register("nameEn")} />
                </Field>
                <Field error={errors.nameAr?.message} label="Name in Arabic">
                  <Input placeholder="Optional Arabic name" {...register("nameAr")} />
                </Field>
                <Field error={errors.gender?.message} label="Gender">
                  <Select
                    aria-label="Gender"
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                    {...register("gender")}
                  >
                    <option value="UNSPECIFIED">Unspecified</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </Select>
                </Field>
              </div>
            </StepSection>
          ) : null}

          {activeStep === 1 ? (
            <StepSection
              description="Identity details are used for operational onboarding, not for direct lifecycle changes."
              icon={<IdCard className="h-5 w-5 text-primary" />}
              title="Identity Info"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field error={errors.nationalId?.message} label="National ID">
                  <Input placeholder="Required" {...register("nationalId")} />
                </Field>
                <Field error={errors.dateOfBirth?.message} label="Date of birth">
                  <Input type="date" {...register("dateOfBirth")} />
                </Field>
              </div>
            </StepSection>
          ) : null}

          {activeStep === 2 ? (
            <StepSection
              description="Confirm contact and joining details before opening the full Picker workspace."
              icon={<MapPin className="h-5 w-5 text-primary" />}
              title="Contact Info"
            >
              <div className="grid gap-4">
                <Field error={errors.address?.message} label="Address">
                  <Input placeholder="Required operational address" {...register("address")} />
                </Field>
                <Field error={errors.joiningDate?.message} label="Joining date">
                  <Input type="date" {...register("joiningDate")} />
                </Field>
              </div>
            </StepSection>
          ) : null}

          {activeStep === 3 ? (
            <StepSection
              description="Review the allowed fields. Role, assignment, status, Shopper ID, password, and lifecycle fields cannot be changed here."
              icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
              title="Final Review"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewItem label="Name" value={values.nameEn || values.nameAr || "Missing"} />
                <ReviewItem label="National ID" value={values.nationalId || "Missing"} />
                <ReviewItem label="Date of birth" value={values.dateOfBirth || "Missing"} />
                <ReviewItem label="Joining date" value={values.joiningDate || "Missing"} />
                <ReviewItem label="Gender" value={values.gender} />
                <ReviewItem label="Address" value={values.address || "Missing"} />
              </div>
              <div className="mt-4 rounded-md border bg-background p-3 text-sm text-muted-foreground">
                Documents are intentionally not collected in Phase 7. This
                phase only completes safe profile fields already present on the
                User model.
              </div>
            </StepSection>
          ) : null}

          {submitError ? <ErrorState message={submitError} /> : null}
          {submitted ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              Profile completed. Opening Picker dashboard.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button
              disabled={activeStep === 0}
              onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
              type="button"
              variant="outline"
            >
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              {activeStep < steps.length - 1 ? (
                <Button
                  onClick={() =>
                    setActiveStep((step) => Math.min(steps.length - 1, step + 1))
                  }
                  type="button"
                >
                  Continue
                </Button>
              ) : (
                <Button disabled={isPending} type="submit">
                  {isPending ? "Submitting..." : "Submit Profile"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function StepSection({
  children,
  description,
  icon,
  title
}: {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section>
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Field({
  children,
  error,
  label
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function ReviewItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-4" role="status">
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <DetailPanelSkeleton />
        <DetailPanelSkeleton />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

function cleanOptional(values: ProfileCompletionFormValues) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== "")
  ) as ProfileCompletionFormValues;
}

function toDateInput(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function formatField(field: string) {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}
