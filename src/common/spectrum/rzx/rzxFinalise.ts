/*
 * Finalises a recording (`.plans/RZX_PLAN.md` §4.1, D3): keeps the first snapshot, drops every later
 * one (the autosave and rollback points) and merges the input blocks into one. Pure.
 *
 * Dropping a snapshot between two input blocks does not change what plays: the snapshot was taken
 * at the point where the earlier block ends, so the later block continues from the very state the
 * earlier one leaves. A rollback discards the blocks after its point before it starts a new one, so
 * the remaining blocks are always contiguous.
 */

import type { RzxBlock, RzxFile, RzxInputBlock } from "./rzxModel";

export function finaliseRzxFile(file: RzxFile): RzxFile {
  const blocks: RzxBlock[] = [];
  let snapshotKept = false;
  let merged: RzxInputBlock | undefined;
  for (const block of file.blocks) {
    if (block.kind === "snapshot") {
      if (!snapshotKept) {
        blocks.push(block);
        snapshotKept = true;
      }
    } else if (block.kind === "input") {
      if (!snapshotKept) continue;
      if (merged) {
        merged.frames.push(...block.frames);
      } else {
        merged = { ...block, frames: [...block.frames] };
        blocks.push(merged);
      }
    } else if (block.kind === "creator") {
      blocks.push(block);
    }
  }
  return { ...file, blocks, notes: [] };
}
