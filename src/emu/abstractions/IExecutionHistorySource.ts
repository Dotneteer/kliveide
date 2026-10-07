import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";

/**
 * A machine that records execution history (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.4): the
 * ZX Spectrum Next now, every Z80 core with G4.2. The Emu API's history handlers and the controller
 * reach it only through `isExecutionHistorySource`, so a core that starts recording needs no new
 * handler.
 */
export interface IExecutionHistorySource {
  /** Names the context decoder of the records (`src/common/history/contexts/`) */
  readonly historyMachineId: string;
  /** What the ring holds; undefined until the core is loaded */
  getHistoryInfo(): ExecutionHistoryInfo | undefined;
  /** Up to `count` records from `fromSequence` on; undefined until the core is loaded */
  readHistory(fromSequence: number, count: number): ExecutionHistoryPage | undefined;
  /** Empties the ring */
  clearHistory(): void;
  /** Turns recording on (debug sessions) or off (D8) */
  setHistoryEnabled(enabled: boolean): void;
}

/** Whether a machine records execution history */
export function isExecutionHistorySource(machine: unknown): machine is IExecutionHistorySource {
  const m = machine as Partial<IExecutionHistorySource> | undefined;
  return (
    !!m &&
    typeof m.historyMachineId === "string" &&
    typeof m.getHistoryInfo === "function" &&
    typeof m.readHistory === "function" &&
    typeof m.clearHistory === "function" &&
    typeof m.setHistoryEnabled === "function"
  );
}
