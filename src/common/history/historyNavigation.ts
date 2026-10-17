import type { HistoryRegisters } from "./historyRecord";
import type { HistoryWalkReason } from "./reverseStep";
import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";

/*
 * The history cursor as it crosses the Emu API (`.plans/LITE_STEP_BACK_PLAN.md` §4.3). Navigation
 * is its own call, not a `MachineCommand` (D4): it never changes the machine.
 */

/** Where to move the history cursor */
export type HistoryNavigationOp =
  | "back"
  | "forward"
  | "backOver"
  | "backOut"
  | "reverseContinue"
  | "present"
  /** A record from the history document (D13), or a step number (`-n`) from `history-goto` */
  | { toSequence: number }
  | { toPosition: number };

export type HistoryNavigationOptions = {
  /** The history document folds interrupt service: Step Back and Step Forward pass over it (D8) */
  foldServices?: boolean;
};

export type HistoryNavigationResult = {
  /** Steps back from the present (1 = the newest record), 0 at the present */
  position: number;
  /** The record the cursor is on; undefined at the present */
  sequence?: number;
  /** The cursor moved */
  moved: boolean;
  /** Why it did not get where it was asked to go */
  reason?: HistoryWalkReason | "running" | "noHistory" | "gone" | "canceled";
  /** The call/return pairing disagreed with SP here (T3) */
  uncertain?: boolean;
  /** What to tell the user: the start of recorded history, conditions that were not checked */
  notes?: string[];
  /** Reverse Continue: the breakpoint that was hit (its address text) */
  breakpoint?: string;
};

/** What `Z80CpuState.history` says while a cursor is set (D2) */
export type HistoricalCpuInfo = {
  /** Steps back from the present: 1 = the newest record */
  position: number;
  sequence: number;
  frame: number;
  /** The position in the frame, in the machine's unit */
  tact: number;
  /** The instruction is the first of an interrupt routine: what entered it (D8) */
  enteredBy?: "int" | "nmi";
  /** The interrupt mode of the INT that entered it */
  enteredByMode?: number;
  /** A coalesced HALT record: how many times it repeated */
  haltRepeat?: number;
  /**
   * The registers one step older (the record before this one): the CPU panel marks what the
   * instruction just before this point changed (Q2). Undefined at the start of recorded history.
   */
  previousRegs?: HistoryRegisters;
  /**
   * Whether memory and devices show the same moment (D14): false for the lite provider, whose
   * memory is the present. The views' "present" banners key off it.
   */
  memoryIsHistorical: boolean;
};

/** The step text of a position: "−42" */
export function historyStepText(position: number): string {
  return `−${position.toLocaleString("en-US")}`;
}

/** The user-facing text of a navigation that did not move, or undefined */
export function historyReasonText(
  result: Pick<HistoryNavigationResult, "reason">,
  recorded?: number
): string | undefined {
  // --- With the ring's size, or without it: two whole messages each
  const withCount = (plain: MessageKey, counted: MessageKey) =>
    recorded === undefined ? t(plain) : t(counted, { count: recorded });
  switch (result.reason) {
    case "start":
      return withCount("commands.history.reason.start", "commands.history.reason.startCount");
    case "noHit":
      return withCount("commands.history.reason.noHit", "commands.history.reason.noHitCount");
    case "noCall":
      return withCount("commands.history.reason.noCall", "commands.history.reason.noCallCount");
    case "present":
      return t("commands.history.reason.present");
    case "empty":
      return t("commands.history.reason.empty");
    case "running":
      return t("commands.history.reason.running");
    case "noHistory":
      return t("commands.history.reason.noHistory");
    case "gone":
      return t("commands.history.reason.gone");
    case "canceled":
      return t("commands.history.reason.canceled");
  }
  return undefined;
}
