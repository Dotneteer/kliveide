import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import type { NexSidecarBreakpointKind } from "./nexAnnotations";
import { sidecarKindOf } from "./nexBreakpointSync";

/**
 * What a popped-out NEX bank's gutter shows, and what the viewer's bank heading counts.
 *
 * Pure on purpose: both answers are decidable from a list of breakpoints, and neither wants a
 * mounted component to check. See `.plans/NEX_DEBUGGING_PLAN.md` §10.1 and §10.2.
 */

/** Breakpoints in one bank, grouped by the offset they sit at. Several can share one offset. */
export type BankBreakpointsByOffset = Map<number, BreakpointInfo[]>;

/**
 * Group a bank's breakpoints by offset.
 *
 * Only bank-relative ones, and only this bank's: an address breakpoint that happens to fall inside
 * the bank's current window is not a breakpoint *on the bank*, and would light up a row that has
 * nothing to do with it as soon as the bank were paged somewhere else.
 */
export function groupBankBreakpointsByOffset(
  breakpoints: BreakpointInfo[],
  bank: number
): BankBreakpointsByOffset {
  const byOffset: BankBreakpointsByOffset = new Map();
  for (const bp of breakpoints) {
    if (bp.bank !== bank || bp.bankOffset === undefined) continue;
    const at = byOffset.get(bp.bankOffset);
    if (at) {
      at.push(bp);
    } else {
      byOffset.set(bp.bankOffset, [bp]);
    }
  }
  return byOffset;
}

/**
 * Which of several breakpoints at one offset the row's single glyph represents.
 *
 * A row has one gutter cell, and an offset can carry an execution breakpoint *and* a watchpoint —
 * "stop when this instruction runs" and "stop when this byte is written" are different questions
 * about the same address, and wanting both is ordinary. Something has to be chosen, and the choice
 * has to be deterministic: before this existed the map simply kept whichever the list ended with, so
 * the glyph — and the `bp-del` command built from it — changed with the order the emulator happened
 * to return.
 *
 * Execution wins, because the gutter's own click gesture creates execution breakpoints, so it is the
 * kind a user reads that column as being about. An enabled breakpoint wins over a disabled one of
 * the same kind, so a row never looks disarmed while something there is live.
 *
 * The rest are still listed in the Breakpoints panel, and the bank heading's badge counts all of
 * them — so nothing is *hidden*, it is only not what this one glyph is about.
 */
export function selectBankRowBreakpoint(candidates: BreakpointInfo[]): BreakpointInfo | undefined {
  if (!candidates?.length) return undefined;

  let best: BreakpointInfo | undefined;
  let bestRank = -1;
  for (const bp of candidates) {
    const rank = rowGlyphRank(bp);
    if (rank > bestRank) {
      best = bp;
      bestRank = rank;
    }
  }
  return best;
}

/** Higher wins in `selectBankRowBreakpoint`. Enabled beats disabled within a kind. */
function rowGlyphRank(bp: BreakpointInfo): number {
  const kindRank = bp.exec ? 2 : sidecarKindOf(bp) === undefined ? 0 : 1;
  return kindRank * 2 + (bp.disabled ? 0 : 1);
}

/** The breakpoint kinds a bank can carry. I/O breakpoints watch ports, so they have no bank. */
export type BankBreakpointKind = NexSidecarBreakpointKind;

/** In the order the bank list and its details show them. */
export const BANK_BREAKPOINT_KINDS: readonly BankBreakpointKind[] = ["exec", "memRead", "memWrite"];

/** The words for a kind, as the details pane and the tooltip say them. */
export const BANK_BREAKPOINT_KIND_NAMES: Record<BankBreakpointKind, string> = {
  exec: "execution",
  memRead: "memory read",
  memWrite: "memory write"
};

/** The gutter's glyph for a kind, so the bank list and the listing draw the same shape. */
export const BANK_BREAKPOINT_KIND_ICONS: Record<BankBreakpointKind, string> = {
  exec: "bp-exec",
  memRead: "bp-mem-read",
  memWrite: "bp-mem-write"
};

/** What a bank carries, for its breakpoint mark. */
export type BankBreakpointSummary = {
  total: number;
  exec: number;
  memRead: number;
  memWrite: number;
  disabled: number;
  /** How many of each kind are disabled; they are included in the kind's own count too. */
  disabledByKind: Record<BankBreakpointKind, number>;
};

/**
 * How many breakpoints each bank carries, and of what kinds.
 *
 * Keyed by bank so one pass over the emulator's list answers every bank row in the viewer; a viewer
 * showing 40 banks must not ask 40 times.
 */
export function summarizeBankBreakpoints(
  breakpoints: BreakpointInfo[]
): Map<number, BankBreakpointSummary> {
  const summaries = new Map<number, BankBreakpointSummary>();
  for (const bp of breakpoints) {
    if (bp.bank === undefined || bp.bankOffset === undefined) continue;
    const kind = sidecarKindOf(bp);
    // --- An I/O breakpoint has a port rather than a bank, so one claiming a bank is malformed
    // --- rather than merely uninteresting. Counting it would inflate a badge nothing can explain.
    if (kind === undefined) continue;

    let summary = summaries.get(bp.bank);
    if (!summary) {
      summary = {
        total: 0,
        exec: 0,
        memRead: 0,
        memWrite: 0,
        disabled: 0,
        disabledByKind: { exec: 0, memRead: 0, memWrite: 0 }
      };
      summaries.set(bp.bank, summary);
    }
    summary.total += 1;
    summary[kind] += 1;
    if (bp.disabled) {
      summary.disabled += 1;
      summary.disabledByKind[kind] += 1;
    }
  }
  return summaries;
}

/**
 * The badge's text and its tooltip.
 *
 * The text is the count alone — a bank heading is a dense line already, and the number is the only
 * part worth reading at a glance. The breakdown goes in the tooltip, which is where the heading's
 * other chips put their detail too.
 *
 * `undefined` for a bank with nothing armed: an absent badge, not a zero. A row of `0` badges down
 * the viewer would be noise claiming to be information.
 */
export function formatBankBreakpointBadge(
  summary: BankBreakpointSummary | undefined
): { text: string; title: string } | undefined {
  if (!summary || summary.total === 0) return undefined;

  const parts: string[] = [];
  if (summary.exec) parts.push(`${summary.exec} execution`);
  if (summary.memRead) parts.push(`${summary.memRead} memory read`);
  if (summary.memWrite) parts.push(`${summary.memWrite} memory write`);
  if (summary.disabled) parts.push(`${summary.disabled} disabled`);

  return {
    text: `${summary.total}`,
    title:
      `${summary.total} breakpoint${summary.total === 1 ? "" : "s"} in this bank` +
      (parts.length ? ` — ${parts.join(", ")}` : "")
  };
}

/** One kind's part of a bank's breakpoint mark. */
export type BankBreakpointMarkCount = { kind: BankBreakpointKind; count: number };

/**
 * The bank list's `BP` chip: which kinds to draw, with what counts, and whether it is greyed out.
 *
 * The row counts what will actually stop the machine, so disabled breakpoints are left out — unless
 * every one is disabled. Then the chip still shows them, greyed, because a bank that *has*
 * breakpoints must not look like one that has none; one click in the gutter brings them back.
 *
 * `undefined` for a bank with nothing set.
 */
export function bankBreakpointMark(
  summary: BankBreakpointSummary | undefined
): { off: boolean; counts: BankBreakpointMarkCount[]; title: string } | undefined {
  const badge = formatBankBreakpointBadge(summary);
  if (!summary || !badge) return undefined;
  const off = summary.disabled >= summary.total;
  const counts = BANK_BREAKPOINT_KINDS.map((kind) => ({
    kind,
    count: off ? summary[kind] : summary[kind] - summary.disabledByKind[kind]
  })).filter((c) => c.count > 0);
  return { off, counts, title: badge.title };
}

/**
 * The details pane's breakpoint line, one entry per kind present: `2 execution (1 disabled)`.
 *
 * Every breakpoint is listed here, disabled ones included — this is where the row's chip, which
 * counts only the enabled ones, is explained in words.
 */
export function describeBankBreakpoints(
  summary: BankBreakpointSummary | undefined
): { kind: BankBreakpointKind; text: string }[] {
  if (!summary) return [];
  return BANK_BREAKPOINT_KINDS.filter((kind) => summary[kind] > 0).map((kind) => {
    const disabled = summary.disabledByKind[kind];
    return {
      kind,
      text:
        `${summary[kind]} ${BANK_BREAKPOINT_KIND_NAMES[kind]}` +
        (disabled ? ` (${disabled === summary[kind] ? "disabled" : `${disabled} disabled`})` : "")
    };
  });
}
