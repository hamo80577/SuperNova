import assert from "node:assert/strict";

import { createManyInChunks } from "../src/common/database/create-many-in-chunks";

async function runLargeInsertUsesBoundedCreateManyCalls() {
  const rows = Array.from({ length: 1_201 }, (_, id) => ({ id }));
  const insertedRows: Array<{ id: number }> = [];
  const chunkSizes: number[] = [];

  const insertedCount = await createManyInChunks(rows, async (chunk) => {
    chunkSizes.push(chunk.length);
    insertedRows.push(...chunk);
    return { count: chunk.length };
  });

  assert.equal(insertedCount, rows.length);
  assert.deepEqual(chunkSizes, [500, 500, 201]);
  assert.deepEqual(insertedRows, rows);
}

void runLargeInsertUsesBoundedCreateManyCalls();
