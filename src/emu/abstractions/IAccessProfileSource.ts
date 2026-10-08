import type { ProfileCounts, ProfileInfo, ProfileTouchedByte } from "@common/profile/profileTypes";

/**
 * A machine whose core keeps an access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.2):
 * code coverage, the memory heat map and the flat profiler's time. The Emu API's profile handlers and
 * the controller reach it only through `isAccessProfileSource`, so a core that starts profiling needs
 * no new handler.
 *
 * Offsets are the core's profile offsets; `profileLayoutOf(profileMachineId)` names them.
 */
export interface IAccessProfileSource {
  /** Names the layout of the offsets (`src/common/profile/layouts/`) */
  readonly profileMachineId: string;
  /** What the profile holds; undefined until the core is loaded (or when it does not profile) */
  getProfileInfo(): ProfileInfo | undefined;
  /** Turns profiling on or off; `counters` keeps the counter pool as well as the flags (D2, D6) */
  setProfiling(enabled: boolean, counters: boolean): void;
  /** Clears the flags, the counters and the time buckets */
  resetProfile(): void;
  /** The flags of `length` offsets from `start` */
  readProfileFlags(start: number, length: number): Uint8Array | undefined;
  /** The counters of `length` offsets from `start` */
  readProfileCounts(start: number, length: number): ProfileCounts | undefined;
  /** Every touched byte (with one of `mask`'s flags), with its counters where kept */
  readProfileTouched(mask?: number): ProfileTouchedByte[] | undefined;
  /**
   * The profile offset the CPU reads at an address through the current mapping, for a machine whose
   * partitions cannot say it (the Z88: mirrored small cards, segment 0's half bank); undefined when
   * nothing backs the address. Without it, the layout and `getPartition` answer.
   */
  currentProfileOffset?(address: number): number | undefined;
  /** Merges a saved run into the profile (D16, `coverage load`): flags OR-ed, counts added */
  mergeProfile(bytes: readonly ProfileTouchedByte[], totals: { instructions: number; timeTotal: number }): void;
}

/** Whether a machine keeps an access profile */
export function isAccessProfileSource(machine: unknown): machine is IAccessProfileSource {
  const m = machine as Partial<IAccessProfileSource> | undefined;
  return (
    !!m &&
    typeof m.profileMachineId === "string" &&
    typeof m.getProfileInfo === "function" &&
    typeof m.setProfiling === "function" &&
    typeof m.resetProfile === "function" &&
    typeof m.readProfileFlags === "function" &&
    typeof m.readProfileCounts === "function" &&
    typeof m.readProfileTouched === "function" &&
    typeof m.mergeProfile === "function"
  );
}
