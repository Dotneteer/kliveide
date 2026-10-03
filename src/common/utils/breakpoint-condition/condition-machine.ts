import type { ConditionEnvironment } from "./condition-types";

/*
 * The machine facts a condition is checked against (plan §3.7 rules 3-5), built the same way in the
 * IDE (to validate what is typed) and in the emulator (to arm it), from the machine id and its
 * partition labels. One builder for both sides is what keeps them from disagreeing (C1): a
 * condition the IDE accepted must compile the same way where it runs.
 */

/** The machine ids this needs; the values of `MI_*` in `@common/machines/constants`. */
const MACHINE_ZXNEXT = "zxnext";
const MACHINE_C64 = "c64";

/** Everything in a `ConditionEnvironment` except the breakpoint's own kind and the symbols. */
export type ConditionMachineFacts = Omit<ConditionEnvironment, "accessKind" | "symbols">;

/**
 * @param machineId The machine's id
 * @param partitionLabels The machine's `getPartitionLabels()` map; empty when it has no partitions
 */
export function conditionMachineFacts(
  machineId: string | undefined,
  partitionLabels: Record<number, string> | undefined
): ConditionMachineFacts {
  const labels = partitionLabels ?? {};
  const indexes = Object.keys(labels).map(Number);
  const isNext = machineId === MACHINE_ZXNEXT;
  const byLabel = new Map<string, number>();
  for (const index of indexes) byLabel.set(labels[index].toUpperCase(), index);

  return {
    // --- The only non-Z80 machine (C18)
    isZ80: machineId !== MACHINE_C64,
    hasPartitions: indexes.length > 0,
    isNext,
    parsePartitionLabel: (label) => {
      const upper = label.toUpperCase();
      const exact = byLabel.get(upper);
      if (exact !== undefined) return exact;
      // --- The Next names a RAM page by its hex index; `5` is `05`, as `bp-set` reads it
      if (isNext && /^[0-9A-F]{1,2}$/.test(upper)) {
        const index = parseInt(upper, 16);
        return labels[index] !== undefined ? index : undefined;
      }
      return undefined;
    },
    ...(indexes.length > 0
      ? { partitionRange: { min: Math.min(...indexes), max: Math.max(...indexes) } }
      : {})
  };
}
