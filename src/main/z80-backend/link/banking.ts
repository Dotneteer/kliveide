import type { CodebankDebugInfo } from "@abstractions/SourceDebugInfo";

import type { EmittedProgram } from "../emit/emit";
import type { BackendOptions } from "../options";
import type { BackendProblem } from "../problems";
import { KLIVE_FAR_RECORDS } from "@common/utils/source-debug-upgrade";

/**
 * Banked code (Klive BASIC's CODEBANK, plan `.plans/ZXBASIC_COMPILER_PLAN.md` §9.2): where each
 * logical bank goes, the far-call runtime's parameters, and how the debugger sees it.
 */
export type BankPlan = {
  placement: Map<number, { page: number; address: number; pages: number }>;
  layout: { slot: number; slots: number; depth: number; pages: number[] };
};

/**
 * Places the banks: logical bank n in `firstPage + (n - 1) * slots`, or at the n-th entry of `pages`
 * (past its end, allocation goes on after its last page). A problem when the window or the pages are
 * invalid.
 */
export function planBanks(banks: number[], options: BackendOptions): BankPlan | Extract<BackendProblem, { kind: "bank-window" | "bank-page" }> {
  const { window, windowSize, firstPage, depth } = options.codebank;
  const slots = windowSize === "16k" ? 2 : 1;
  if (window % 0x2000 !== 0) return { kind: "bank-window", detail: "boundary", window, sizeK: slots * 8 };
  if (window + slots * 0x2000 > 0x10000) return { kind: "bank-window", detail: "pastEnd", window, sizeK: slots * 8 };
  const listed = options.codebank.pages ?? [];
  const pageOf = (bank: number) =>
    bank <= listed.length ? listed[bank - 1] : listed.length ? listed[listed.length - 1] + (bank - listed.length) * slots : firstPage + (bank - 1) * slots;
  const maxBank = banks.length ? banks[banks.length - 1] : 0;
  const pages = [0];
  for (let bank = 1; bank <= maxBank; bank++) pages.push(pageOf(bank));
  for (const bank of banks) {
    const page = pageOf(bank);
    if (page < 0 || page + slots - 1 > 223) return { kind: "bank-page", detail: "page", bank, page };
    if (slots === 2 && page % 2 !== 0) return { kind: "bank-page", detail: "oddPage", bank, page };
  }
  return {
    placement: new Map(banks.map((bank) => [bank, { page: pageOf(bank), address: window, pages: slots }])),
    layout: { slot: window >> 13, slots, depth, pages }
  };
}

/** The far-call runtime as the debugger needs it (plan §9.4): the window, the runtime's state, the pages. */
export function codebankDebugInfo(banking: BankPlan, options: BackendOptions, symbol: (name: string) => number | undefined): CodebankDebugInfo {
  const at = (name: string) => symbol(`core.${name}`) ?? 0;
  return {
    window: options.codebank.window,
    windowSize: banking.layout.slots * 0x2000,
    farCall: at("FarCall"),
    farReturn: at("FarReturn"),
    currentBank: at("FarBank"),
    shadowStackPointer: at("FarSP"),
    shadowStack: at("FarStack"),
    // --- banking.kz80.asm: a 3-byte record [caller's bank, return address] per cross-bank call, growing up
    records: KLIVE_FAR_RECORDS,
    banks: [...banking.placement].map(([bank, place]) => ({
      bank,
      pages: Array.from({ length: place.pages }, (_, i) => place.page + i)
    }))
  };
}

/** The bank whose section holds a line of the generated program (its `__kbBank<n>:` label above it). */
export function bankAtLine(emitted: EmittedProgram, line: number): number | undefined {
  const text = emitted.text.split("\n");
  for (let n = Math.min(line, text.length) - 1; n >= 0; n--) {
    const m = /^__kbBank(\d+):/.exec(text[n]);
    if (m) return Number(m[1]);
  }
  return undefined;
}
