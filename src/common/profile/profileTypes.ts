/*
 * The access profile's shapes as they cross the Emu API (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`
 * §4.2): code coverage (G5.1), the memory heat map (G5.2) and the flat profiler's time (G5.3).
 *
 * Everything is indexed by the core's *profile offset*: one linear space laid over its physical ROM
 * and RAM (`layouts/`). A layout turns an offset into a partition and an address, and back.
 */

/** The flag byte's bits (`z80-profile.h`, D3) */
export const PF_EXECUTED = 0x01;
export const PF_CODE = 0x02;
export const PF_READ = 0x04;
export const PF_WRITTEN = 0x08;
export const PF_SELF_MODIFIED = 0x10;
export const PF_INTERRUPT = 0x20;

/** The pool's page size: counters are kept per 8K physical page */
export const PROFILE_PAGE_SIZE = 0x2000;
/** The size of one counter entry, and of the header, in bytes (`z80-profile.c`) */
export const PROFILE_ENTRY_SIZE = 24;
export const PROFILE_HEADER_SIZE = 128;

/** What the core's profile holds now */
export type ProfileInfo = {
  /** The machine whose layout names the offsets (`profileLayoutOf`) */
  machineId: string;
  /** Whether the hooks count */
  enabled: boolean;
  /** Whether the counter pool is kept, not only the flags */
  counters: boolean;
  /** Whether a replay is running now (D10): nothing counts */
  muted: boolean;
  /** The core's physical span in bytes */
  flagBytes: number;
  /** The pool's capacity, its use, and the pages that found it full (T6) */
  poolPages: number;
  pagesUsed: number;
  pagesDropped: number;
  /** The first page that found the pool full; -1 when none did */
  firstDroppedPage: number;
  /** Time not charged to an address, in the core's unit (D7, D8) */
  timeIntAck: number;
  timeNmiAck: number;
  timeDma: number;
  timeSnooze: number;
  /** HALTed time: charged to the HALT's address, and summed here */
  timeHalt: number;
  /** Everything measured */
  timeTotal: number;
  /** Instruction starts counted */
  instructions: number;
  /** Bumped by every reset: a reader's caches are stale when it changes */
  generation: number;
  /** What the time counts in ("T-states", or the Next's "28 MHz ticks") */
  timeUnit: string;
};

/** The counters of a run of profile offsets */
export type ProfileCounts = {
  /** The first profile offset */
  start: number;
  exec: Uint32Array;
  read: Uint32Array;
  write: Uint32Array;
  /** The time of the instructions that started at each byte */
  time: Float64Array;
  /** 1 for a byte whose page has counters, 0 for one whose page found the pool full or was never touched */
  counted: Uint8Array;
};

/** One touched byte, for exports and the self-modifying-code report */
export type ProfileTouchedByte = {
  offset: number;
  flags: number;
  /** Undefined when the byte's page has no counters */
  exec?: number;
  read?: number;
  write?: number;
  time?: number;
};

/** The flags (and counts) of the 64K the CPU sees now, or of one partition */
export type ProfileView = {
  /** The partition, or undefined for the current 64K mapping */
  partition?: number;
  /** The CPU address of the first byte (0 for the 64K view) */
  baseAddress: number;
  /** One flag byte per byte of the view; 0 where nothing backs it */
  flags: Uint8Array;
  /** The counters per byte; undefined when the profile keeps no counters */
  counts?: Omit<ProfileCounts, "start">;
  info: ProfileStatus;
};

/** What the profile holds, with what the machine controller adds (`coverage status`) */
export type ProfileStatus = ProfileInfo & {
  /**
   * Instructions counted in a future that Take over here abandoned (D10, Q4); the counts keep them
   * until the next reset
   */
  abandonedInstructions: number;
};

/** The flags (and execution counts) at a list of addresses: what the editor strip reads */
export type ProfileSample = {
  info: ProfileStatus;
  /** One flag byte per requested address (0 where nothing backs it) */
  flags: Uint8Array;
  /** Execution counts per requested address, when asked for and kept */
  exec?: Uint32Array;
};

/** Every touched byte: what the exports and the self-modifying-code report read */
export type ProfileTouched = {
  info: ProfileStatus;
  bytes: ProfileTouchedByte[];
};
