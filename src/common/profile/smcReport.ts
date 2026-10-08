import { profileLocationOf, type ProfileLayout } from "./layouts/profileLayout";
import { PF_SELF_MODIFIED, type ProfileTouchedByte } from "./profileTypes";

/*
 * The self-modifying-code report (`coverage smc`, `.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D9):
 * runs of self-modified bytes, each with its partition, the nearest label at or before it, and -
 * where counters were kept - how often it was written and executed.
 */

export type SmcRun = {
  /** The first and last profile offsets of the run */
  from: number;
  to: number;
  /** Where it lives: the partition (undefined on a fixed map) and its address there */
  partition?: number;
  address: number;
  /** The nearest label at or before the run, and how far the run is past it */
  label?: string;
  labelOffset?: number;
  /** Summed over the run's bytes, when counters were kept */
  writes?: number;
  executions?: number;
};

/**
 * @param bytes The touched bytes (`getProfileTouched`), in offset order
 * @param labelAt The nearest label at or before a CPU address in a partition (the compilation's symbols)
 */
export function findSmcRuns(
  bytes: readonly ProfileTouchedByte[],
  layout: ProfileLayout,
  labelAt?: (address: number, partition: number | undefined) => { name: string; address: number } | undefined
): SmcRun[] {
  const runs: SmcRun[] = [];
  let current: SmcRun | undefined;
  for (const b of bytes) {
    if ((b.flags & PF_SELF_MODIFIED) === 0) continue;
    if (current && b.offset === current.to + 1) {
      current.to = b.offset;
      addCounts(current, b);
      continue;
    }
    const location = profileLocationOf(layout, b.offset);
    // --- A partition's address is its offset there; the label lookup wants the CPU address it is
    // --- assembled at, which only the program knows: the partition's own address is the best guess
    const address = location?.address ?? b.offset;
    current = { from: b.offset, to: b.offset, partition: location?.partition, address };
    const label = labelAt?.(address, location?.partition);
    if (label) {
      current.label = label.name;
      current.labelOffset = address - label.address;
    }
    addCounts(current, b);
    runs.push(current);
  }
  return runs;
}

function addCounts(run: SmcRun, b: ProfileTouchedByte): void {
  if (b.write !== undefined) run.writes = (run.writes ?? 0) + b.write;
  if (b.exec !== undefined) run.executions = (run.executions ?? 0) + b.exec;
}
