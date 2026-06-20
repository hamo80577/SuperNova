export const DEFAULT_CREATE_MANY_CHUNK_SIZE = 500;

export async function createManyInChunks<T>(
  data: T[],
  createMany: (chunk: T[]) => Promise<{ count: number }>,
  chunkSize = DEFAULT_CREATE_MANY_CHUNK_SIZE
) {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("createMany chunk size must be a positive integer.");
  }

  let insertedCount = 0;

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);
    const result = await createMany(chunk);
    insertedCount += result.count;
  }

  return insertedCount;
}
