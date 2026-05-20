import { Prisma, PrismaClient, RequestStatus } from "@prisma/client";

const OPEN_STATUSES = [
  RequestStatus.DRAFT,
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN
] as const;

const prisma = new PrismaClient();
const confirmed = process.argv.includes("--confirm");

async function main() {
  console.log("Local/dev cleanup: open requests only.");
  console.log(`Mode: ${confirmed ? "CONFIRM" : "DRY-RUN"}`);

  const counts = await Promise.all(
    OPEN_STATUSES.map(async (status) => ({
      status,
      count: await prisma.request.count({ where: { status } })
    }))
  );
  const total = counts.reduce((sum, item) => sum + item.count, 0);

  console.log("Open request counts:");
  counts.forEach((item) => {
    console.log(`- ${item.status}: ${item.count}`);
  });
  console.log(`Total open requests: ${total}`);

  if (!total) {
    console.log("Nothing to delete.");
    return;
  }

  if (!confirmed) {
    console.log("Dry-run only. Re-run with --confirm to delete these open requests.");
    return;
  }

  const requests = await prisma.request.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    select: { id: true, status: true }
  });
  const requestIds = requests.map((request) => request.id);

  const result = await prisma.$transaction(async (tx) => {
    const approvalDelete = await tx.requestApproval.deleteMany({
      where: { requestId: { in: requestIds } }
    });

    const notificationDelete = await deleteNotificationsForRequests(tx, requestIds);

    const requestDelete = await tx.request.deleteMany({
      where: {
        id: { in: requestIds },
        status: { in: [...OPEN_STATUSES] }
      }
    });

    return {
      approvals: approvalDelete.count,
      notifications: notificationDelete,
      requests: requestDelete.count
    };
  });

  console.log("Deleted open request data:");
  console.log(`- approvals: ${result.approvals}`);
  console.log(`- notifications: ${result.notifications}`);
  console.log(`- requests: ${result.requests}`);
  console.log("Completed/rejected/cancelled/approved request history was not targeted.");
}

async function deleteNotificationsForRequests(
  tx: Prisma.TransactionClient,
  requestIds: string[]
) {
  let deleted = 0;

  for (const chunk of chunks(requestIds, 50)) {
    const result = await tx.notification.deleteMany({
      where: {
        OR: chunk.map((requestId) => ({
          payload: {
            path: ["requestId"],
            equals: requestId
          }
        }))
      }
    });
    deleted += result.count;
  }

  return deleted;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
