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
/** A HALT waited here: the byte's time is mostly waiting (`.plans/PROFILER_PLAN.md` D4) */
export const PF_HALT = 0x40;

/** The pool's page size: counters are kept per 8K physical page */
export const PROFILE_PAGE_SIZE = 0x2000;
/** The size of one counter entry, and of the header, in bytes (`z80-profile.c`) */
export const PROFILE_ENTRY_SIZE = 24;
export const PROFILE_HEADER_SIZE = 192;
/** The call tracker's edge and frame sizes (`.plans/PROFILER_PLAN.md` §4.2) */
export const PROFILE_EDGE_SIZE = 32;
export const PROFILE_FRAME_SIZE = 48;

/*
 * The call tracker's keys (`z80-profile.c`): a callee or caller is a profile offset; these values
 * above every profile span name the roots and the overflow edge
 */
/** The code outside every tracked call: what ran before profiling started (T5) or between calls */
export const PROFILE_KEY_ROOT = 0xffffffff;
/** The maskable interrupt's root (D11) */
export const PROFILE_KEY_INT = 0xfffffffe;
/** The NMI's root */
export const PROFILE_KEY_NMI = 0xfffffffd;
/** The edge that collects calls once the edge table is full (D12) */
export const PROFILE_KEY_OTHER = 0xfffffffc;
/** A callee nothing backs is keyed by its address with this bit set */
export const PROFILE_KEY_UNMAPPED = 0x40000000;

/** Whether a call-tracker key is a root (or the overflow edge) rather than a routine's entry */
export function isProfileRootKey(key: number): boolean {
  return key >= PROFILE_KEY_OTHER;
}

/** The event that first made an edge */
export type ProfileEdgeKind = "call" | "rst" | "int" | "im2" | "nmi";

/** One caller/callee pair of the call graph (G5.4), its time in the core's unit */
export type ProfileEdge = {
  /** The caller's entry (a profile offset), or a root key */
  caller: number;
  /** The callee's entry: a profile offset, or `PROFILE_KEY_UNMAPPED | address` */
  callee: number;
  /** The callee's CPU address when it was called */
  calleeAddress: number;
  kind: ProfileEdgeKind;
  calls: number;
  /** Counted at the callee's outermost activation only (D12: recursion is not counted twice) */
  inclusive: number;
  exclusive: number;
  /** Activations still open when the edges were read: their time so far is included */
  open?: number;
};

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
  // --- The call tracker (`.plans/PROFILER_PLAN.md` D1, D9-D12)
  /** Whether the call tracker runs */
  callsOn: boolean;
  /** Frames open now */
  depth: number;
  /** Stack switches that flushed the call stack (D10) */
  stackResyncs: number;
  /** Calls past the stack's depth, not tracked (D10) */
  depthOverflows: number;
  /** Calls whose edge found the table full, charged to (other) (D12) */
  edgesDropped: number;
  edgesUsed: number;
  edgeCapacity: number;
  /** CALL and RST pushes tracked */
  calls: number;
  /** Interrupt and NMI pushes tracked */
  interrupts: number;
  /** The armed window's markers (D2): CPU addresses, -1 when not armed */
  armedStart: number;
  armedStop: number;
  /** Bumped when an armed stop fired */
  windowClosed: number;
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
  /** One emulated frame in the time unit (PROFILER_PLAN D5): the "per frame" columns divide by it */
  frameTicks?: number;
  /** The time unit's frequency in Hz, for wall time (D5) */
  clockHz?: number;
};

/** The call graph's edges (`getProfileEdges`) */
export type ProfileEdges = {
  info: ProfileStatus;
  edges: ProfileEdge[];
};

/** The flags (and execution counts) at a list of addresses: what the editor strip reads */
export type ProfileSample = {
  info: ProfileStatus;
  /** One flag byte per requested address (0 where nothing backs it) */
  flags: Uint8Array;
  /** Execution counts per requested address, when asked for and kept */
  exec?: Uint32Array;
  /** The time of the instructions starting at each address, with `exec` (`.plans/PROFILER_PLAN.md` D15) */
  time?: Float64Array;
};

/** Every touched byte: what the exports and the self-modifying-code report read */
export type ProfileTouched = {
  info: ProfileStatus;
  bytes: ProfileTouchedByte[];
};
