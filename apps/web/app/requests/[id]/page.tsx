import { redirect } from "next/navigation";

export default async function RequestDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tickets?requestId=${id}`);
}
