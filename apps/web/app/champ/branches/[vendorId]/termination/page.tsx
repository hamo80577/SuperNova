import { redirect } from "next/navigation";

export default async function ChampBranchTerminationPage({
  params
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  redirect(`/champ/branches/${vendorId}`);
}
