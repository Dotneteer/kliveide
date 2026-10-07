import { decodeHistoryPage, type HistoryRecord } from "@common/history/historyRecord";
import type { ExecutionHistoryInfo } from "@common/history/historyTypes";
import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";

/*
 * The execution-history recorder as every harness reads it (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`
 * §6): through the machine's `IExecutionHistorySource`, as the IDE does. Each session's
 * `recordHistory`, `clearHistory`, `historyInfo`, `history` and `historyFrom` delegate here.
 */

/** What the ring holds: capacity, count, newest and oldest sequence, generation, enabled */
export function historyInfoOf(source: IExecutionHistorySource): ExecutionHistoryInfo {
  const info = source.getHistoryInfo();
  if (!info) throw new Error("The machine's core is not loaded.");
  return info;
}

/**
 * The newest `count` history records (all held when omitted), oldest first, decoded, with full
 * sequence numbers. Each holds the state *before* its instruction or event.
 */
export function historyOf(source: IExecutionHistorySource, count?: number): HistoryRecord[] {
  const info = historyInfoOf(source);
  const n = Math.min(count ?? info.count, info.count);
  if (n === 0) return [];
  return decodeHistoryPage(source.readHistory(info.newestSequence - n + 1, n)!);
}

/** History records from `fromSequence` on: the reader's page, decoded, with its `gone` flag */
export function historyFromOf(
  source: IExecutionHistorySource,
  fromSequence: number,
  count: number
): { records: HistoryRecord[]; gone: boolean } {
  const page = source.readHistory(fromSequence, count)!;
  return { records: decodeHistoryPage(page), gone: page.gone };
}
