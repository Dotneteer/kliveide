import type { RomPageKind } from "@common/roms/romIdentity";
import type { DisassemblyOperandLabelResolver } from "@renderer/appIde/disassemblers/common-types";

import { ANNOTATION_BANK_LAST_OFFSET, getBankAnnotation, type ProgramAnnotations } from "./programAnnotations";
import { romRunOrigin, type RomPageSegment } from "./romDecoder";

/*
 * Naming the operands of a ROM page whose code does not all run at the address the page is listed at.
 *
 * A Cambridge Z88 OZ bank is the case: bank $0A holds EazyLink (run at $8000) and the Filer (run at
 * $E400), bank 2 stores LOWRAM at $0800 and OZ runs it at $0000, and the kernel's two banks (0 and 1)
 * and PipeDream's (5 and 6) call each other's code. The ROM page document lists a page at one address
 * (its `offsetIndex`), so without this an absolute operand is looked up as if it ran there: the Filer's
 * `call $EFF8` names nothing, and LOWRAM's `jp $00E2` names whatever keymap label sits at offset $00E2.
 *
 * Two facts of the sidecar's `pages` entry answer it: `segments`, where each run of the page runs (the
 * same facts the level check and the tools decode by, `romDecoder.ts`), and `pagedWith`, the other pages
 * that are paged in while this one runs. A relative jump (`jr`, `djnz`) needs neither: its target is
 * worked out from the listed address, so it is already an offset in the run it jumps within.
 */

/** Another page paged in while a page runs; with `start`, only its run that starts at that offset. */
export type RomPagedWith = { page: number; start?: number };

/** What a ROM page's `pages` entry says about where its code runs. */
export type RomPageLayout = { segments?: RomPageSegment[]; pagedWith?: RomPagedWith[] };

/** Each page's layout, keyed by the page number as the sidecar keys `pages`. */
export type RomPageLayouts = Readonly<Record<string, RomPageLayout>>;

/** A run of a page: its bank offsets, and the address its offset 0 has while it runs. */
export type RomRun = { start: number; end: number; origin: number };

/** The runs of a page, in order: one per `segments` entry, each up to the next entry's start. */
export function romPageRuns(
  kind: RomPageKind | undefined,
  segments: readonly RomPageSegment[] | undefined
): RomRun[] {
  const starts = [...(segments ?? [])].sort((a, b) => a.start - b.start);
  return starts.map((entry, i) => ({
    start: entry.start,
    end: (starts[i + 1]?.start ?? ANNOTATION_BANK_LAST_OFFSET + 1) - 1,
    origin: romRunOrigin(kind, segments, entry.start)
  }));
}

function runAt(runs: readonly RomRun[], offset: number): RomRun | undefined {
  return runs.find((run) => offset >= run.start && offset <= run.end);
}

/**
 * The page's own rule for an absolute operand (a `jp`/`call` target, an `ld rr,nn` value, a `.defw`
 * word): the address offset to look its local label up against, or `undefined` when the value is not
 * an address of this page while the instruction runs. That is the case when the value lands outside the
 * bank at the instruction's run origin, or in a run that runs elsewhere (the Filer's `$C100` is in
 * EazyLink's bytes, which are not at $C000 while the Filer runs).
 *
 * `undefined` for a page without `segments`: its operands resolve as they always have.
 */
export function absoluteOperandOffsetFor(
  kind: RomPageKind | undefined,
  layout: RomPageLayout | undefined
): ((bankOffset: number, value: number) => number | undefined) | undefined {
  if (!layout?.segments?.length) return undefined;
  const runs = romPageRuns(kind, layout.segments);
  return (bankOffset, value) => {
    const run = runAt(runs, bankOffset & ANNOTATION_BANK_LAST_OFFSET);
    if (!run) return undefined;
    const offset = value - run.origin;
    if (offset < 0 || offset > ANNOTATION_BANK_LAST_OFFSET) return undefined;
    return runAt(runs, offset)?.origin === run.origin ? run.origin : undefined;
  };
}

/**
 * Names an absolute operand from the pages paged in with this one (`pagedWith`): the label at the
 * value's offset in the first of those pages' runs that holds the value while it runs. Only an operand
 * the page's own rule left alone (`labelOutsideBank`): a value inside this page is this page's, named
 * or not. `undefined` when the page has no `pagedWith`.
 *
 * Only a jump or call target (`L`) or a word other than 0 (`W`): the listing asks it about an
 * instruction's jump and call targets and its `.defw` words, never an `ld hl,nn` value, which is as
 * often a number as an address (naming EazyLink's `ld hl,$0000` after LOWRAM's entry at RAM address 0
 * is a guess this page cannot back). A zero word is as often a table's end marker as an address.
 */
export function pagedWithOperandLabelResolver(
  annotations: ProgramAnnotations | undefined,
  kind: RomPageKind | undefined,
  layouts: RomPageLayouts | undefined,
  page: number | undefined
): DisassemblyOperandLabelResolver | undefined {
  const pagedWith = page === undefined ? undefined : layouts?.[String(page)]?.pagedWith;
  if (!annotations || !pagedWith?.length) return undefined;
  const others = pagedWith.flatMap(({ page: other, start }) => {
    const labels = getBankAnnotation(annotations, other)?.localLabels;
    if (!labels?.length) return [];
    const byOffset = new Map(labels.map((label) => [label.value, label.name]));
    return romPageRuns(kind, layouts?.[String(other)]?.segments)
      .filter((run) => start === undefined || run.start === start)
      .map((run) => ({ run, byOffset }));
  });
  if (!others.length) return undefined;
  return (operand) => {
    if (!operand.labelOutsideBank) return undefined;
    const named = operand.pragma === "L" || (operand.pragma === "W" && operand.operandValue !== 0);
    if (!named) return undefined;
    for (const { run, byOffset } of others) {
      const offset = operand.operandValue - run.origin;
      if (offset < run.start || offset > run.end) continue;
      const name = byOffset.get(offset);
      if (name) return name;
    }
    return undefined;
  };
}

/** The layout facts of each page of a raw ROM sidecar: what the ROM page document needs to name across runs. */
export function romPageLayoutsOf(raw: { pages?: Record<string, unknown> } | undefined): RomPageLayouts | undefined {
  const layouts: Record<string, RomPageLayout> = {};
  for (const [key, value] of Object.entries(raw?.pages ?? {})) {
    const { segments, pagedWith } = (value ?? {}) as RomPageLayout;
    if (segments?.length || pagedWith?.length) {
      layouts[key] = { ...(segments?.length ? { segments } : {}), ...(pagedWith?.length ? { pagedWith } : {}) };
    }
  }
  return Object.keys(layouts).length ? layouts : undefined;
}
