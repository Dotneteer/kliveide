/*
 * The TypeScript side of a machine caches what it last pushed into its core - the keyboard rows, the
 * audio sample rate, the clock multiplier - and pushes again only on a change. While a replay runs
 * the journal is muted and those pushes are dropped (`.plans/REVERSE_DEBUGGING_PLAN.md` D8), so the
 * caches no longer say what the core holds. When the timeline returns to live input the controller
 * calls `invalidateHostSync()`, and the next frame pushes the live state again - journaled.
 */
export interface IReplayHostSync {
  invalidateHostSync(): void;
}

export function isReplayHostSync(machine: unknown): machine is IReplayHostSync {
  return typeof (machine as Partial<IReplayHostSync> | undefined)?.invalidateHostSync === "function";
}
