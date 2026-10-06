/*
 * Source-line Copper breakpoints (`.plans/COPPER_DEBUGGING_PLAN.md` D12): a gutter click on a
 * `.copper` line sets a `cu:` breakpoint on the list index that line was uploaded to, found by
 * matching the live Copper RAM against the compilation's `copperBlocks` (D8). Pure helpers; the
 * editor does the I/O.
 */
import type { CopperBlock } from "@common/zxnext/copper/copperBlocks";
import {
  copperIndexesOfSourceLine,
  matchCopperSource
} from "@common/zxnext/copper/copperSourceMatch";

/** A source line that is a `.copper` pragma (optionally after a label), ignoring its comment. */
export function isCopperSourceLine(text: string | undefined): boolean {
  const code = (text ?? "").split(";")[0];
  return /(^|[\s:])\.copper\b/i.test(code);
}

/** The index of the edited file in the compilation's `sourceFileList`, or -1. */
export function copperSourceFileIndex(
  files: { filename: string }[] | undefined,
  resourceName: string | undefined,
  isWindows: boolean
): number {
  if (!files || !resourceName) return -1;
  const sep = isWindows ? "\\" : "/";
  const wanted = resourceName.replaceAll("\\", "/");
  return files.findIndex((f) => f.filename.replaceAll(sep, "/").endsWith(wanted));
}

/**
 * The list indexes a `.copper` source line currently occupies in the Copper's RAM. Empty when the
 * list has not been uploaded yet (or no longer matches its source).
 */
export function copperIndexesForSourceLine(
  ram: Uint8Array | undefined,
  blocks: CopperBlock[] | undefined,
  fileIndex: number,
  line: number
): number[] {
  if (!ram || !blocks?.length || fileIndex < 0) return [];
  return copperIndexesOfSourceLine(matchCopperSource(ram, blocks), fileIndex, line);
}
