/*
 * The host's side of the ZX Spectrum Next's DS1307 (`.ai/zxnext-rtc.md`): which clock
 * it follows, and keeping it between sessions.
 *
 * The core keeps counting emulated time (D3). In host-clock mode this class rewrites the time
 * registers between frames, at most once per host second, so the clock shows `host time + offset`
 * (D4). Every write goes through a journaled export (`zxnextRtcSetTime`, `zxnextRtcSetRegister`), so
 * a reverse-debugging replay applies it where it happened and this class never runs during one.
 *
 * With keep on, the clock (its offset against the host, its control byte and RAM) is loaded at setup
 * and saved through a store port the emulator wires to the main process (D5, D6).
 */

import type { NextRtcKeptEntry } from "@common/zxnext/nextRtcKept";
import { rtcRegistersFromDate, rtcStateOf, rtcTargetRegisters, type RtcClockState } from "./nextRtc";

/** What the clock follows: the host's clock, or emulated time */
export type NextRtcClockMode = "host" | "emulated";

/** Where a kept clock lives (the main process's `zxnext-rtc.json`, or a test's fake) */
export interface NextRtcStore {
  load(profileId: string): Promise<NextRtcKeptEntry | undefined>;
  save(profileId: string, entry: NextRtcKeptEntry): Promise<void>;
}

/** The core exports this class uses */
export type NextRtcExports = {
  zxnextRtcSetTime(...regs: number[]): unknown;
  zxnextRtcPeekRegister(index: number): number;
  zxnextRtcGetWriteCount(): number;
  zxnextRtcGetTimeWriteCount(): number;
  zxnextRtcSetRegister(index: number, value: number): unknown;
};

/** A bus write is saved this long after the last one (a `.time` writes several registers) */
export const RTC_SAVE_DELAY_MS = 1000;
/** How often an emulated clock checks whether it drifted from the kept one */
export const RTC_DRIFT_CHECK_MS = 30_000;
/** How often a host-following clock is compared with the host */
export const RTC_SYNC_INTERVAL_MS = 1000;

const RAM_FIRST = 0x08;
const RAM_SIZE = 56;

export class NextRtcHost {
  private mode: NextRtcClockMode = "emulated";
  private keep = false;
  private store?: NextRtcStore;
  /** Host-clock mode: the offset the clock follows (undefined until known, or for an invalid time) */
  private clock?: RtcClockState;
  private lastSyncMs = Number.NEGATIVE_INFINITY;
  private seenWrites = 0;
  private seenTimeWrites = 0;
  private saveDueMs?: number;
  private lastDriftCheckMs = Number.NEGATIVE_INFINITY;
  /** The model's entry exists in the store (loaded or saved here, not forgotten) */
  private kept = false;
  private keptOffset?: number;
  /** The clock was seeded: before that nothing is read, followed or saved (it would save an empty chip) */
  private seeded = false;

  constructor(
    private readonly exports: () => NextRtcExports | undefined,
    private readonly profileId: () => string,
    private readonly now: () => number
  ) {}

  get clockMode(): NextRtcClockMode {
    return this.mode;
  }

  get keeping(): boolean {
    return this.keep;
  }

  setStore(store: NextRtcStore | undefined): void {
    this.store = store;
  }

  /** Switches what the clock follows; the time it shows does not change (D7) */
  setClockMode(mode: NextRtcClockMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.clock = undefined;
    this.lastSyncMs = Number.NEGATIVE_INFINITY;
    if (mode === "host" && this.seeded) this.takeClockFromRegisters();
  }

  /** Turns keeping on (the current clock becomes the kept one) or off (nothing is read or written) */
  setKeep(keep: boolean): void {
    if (keep === this.keep) return;
    this.keep = keep;
    this.saveDueMs = undefined;
    if (keep) void this.save();
  }

  /**
   * Seeds the clock at setup: the kept one when keep is on and the model has an entry, otherwise the
   * host's time (registers 0-6; the RAM stays as the core has it)
   */
  async seed(): Promise<void> {
    const ex = this.exports();
    if (!ex) return;
    let entry: NextRtcKeptEntry | undefined;
    if (this.keep && this.store) {
      try {
        entry = await this.store.load(this.profileId());
      } catch {
        entry = undefined;
      }
    }
    if (entry) {
      this.applyEntry(ex, entry);
      this.kept = true;
      this.keptOffset = entry.time?.offsetSeconds;
    } else {
      ex.zxnextRtcSetTime(...rtcRegistersFromDate(new Date(this.now())));
      this.kept = false;
      this.keptOffset = undefined;
    }
    this.seeded = true;
    this.rebase();
    if (this.mode === "host") this.takeClockFromRegisters();
  }

  /**
   * The core changed under the machine (a state load, a replay, a return to the present): what the
   * bus wrote there was saved when it happened, so only the counts are taken; the next frame syncs.
   */
  rebase(): void {
    const ex = this.exports();
    this.seenWrites = ex ? ex.zxnextRtcGetWriteCount() >>> 0 : 0;
    this.seenTimeWrites = ex ? ex.zxnextRtcGetTimeWriteCount() >>> 0 : 0;
    this.lastSyncMs = Number.NEGATIVE_INFINITY;
  }

  /** Before each frame (and each debug-run call): sync with the host, save what the bus changed */
  beforeFrame(): void {
    const ex = this.exports();
    if (!ex || !this.seeded) return;
    const now = this.now();
    const writes = ex.zxnextRtcGetWriteCount() >>> 0;
    const timeWrites = ex.zxnextRtcGetTimeWriteCount() >>> 0;
    if (timeWrites !== this.seenTimeWrites) {
      // --- The program set the time (or CH): a host-following clock follows from there
      this.seenTimeWrites = timeWrites;
      if (this.mode === "host") this.takeClockFromRegisters();
    }
    if (writes !== this.seenWrites) {
      this.seenWrites = writes;
      if (this.keep) this.saveDueMs = now + RTC_SAVE_DELAY_MS;
    }
    if (this.mode === "host" && now - this.lastSyncMs >= RTC_SYNC_INTERVAL_MS) {
      this.lastSyncMs = now;
      this.syncWithHost(ex, now);
    }
    if (this.saveDueMs !== undefined && now >= this.saveDueMs) {
      this.saveDueMs = undefined;
      void this.save();
    } else if (this.keep && this.kept && this.mode === "emulated" && now - this.lastDriftCheckMs >= RTC_DRIFT_CHECK_MS) {
      // --- Emulated time drifts from the host's while the machine pauses: keep the drift (D5)
      this.lastDriftCheckMs = now;
      const state = rtcStateOf(this.readTime(ex), now);
      if (state && this.keptOffset !== undefined && Math.abs(state.offsetSeconds - this.keptOffset) >= 2) void this.save();
    }
  }

  /** "Set to host time" (D8): the host's time now, in the program's hour mode; saved when kept */
  setToHost(): void {
    const ex = this.exports();
    if (!ex) return;
    const hours12 = (ex.zxnextRtcPeekRegister(2) & 0x40) !== 0;
    const state: RtcClockState = { offsetSeconds: 0, dayOffset: 0, hours12 };
    ex.zxnextRtcSetTime(...rtcTargetRegisters(state, this.now()));
    if (this.mode === "host") this.clock = state;
    this.lastSyncMs = this.now();
    if (this.keep) void this.save();
  }

  /** "Forget" (D8): the store's entry is gone; the RAM is cleared and the time seeded from the host */
  forget(): void {
    const ex = this.exports();
    if (!ex) return;
    for (let i = 0; i < RAM_SIZE; i++) ex.zxnextRtcSetRegister(RAM_FIRST + i, 0);
    ex.zxnextRtcSetTime(...rtcRegistersFromDate(new Date(this.now())));
    this.kept = false;
    this.keptOffset = undefined;
    this.saveDueMs = undefined;
    this.clock = undefined;
    this.rebase();
    if (this.mode === "host") this.takeClockFromRegisters();
  }

  /** The entry a save would store now */
  captureEntry(): NextRtcKeptEntry | undefined {
    const ex = this.exports();
    if (!ex) return undefined;
    const now = this.now();
    const regs = this.readTime(ex);
    const running = (regs[0] & 0x80) === 0;
    const state = running ? (this.mode === "host" && this.clock ? this.clock : rtcStateOf(regs, now)) : undefined;
    const ram: number[] = [];
    for (let i = 0; i < RAM_SIZE; i++) ram.push(ex.zxnextRtcPeekRegister(RAM_FIRST + i) & 0xff);
    return {
      time: state ? { ...state } : undefined,
      regs,
      control: ex.zxnextRtcPeekRegister(7) & 0xff,
      ram: ram,
      savedAt: now
    };
  }

  private async save(): Promise<void> {
    if (!this.keep || !this.store || !this.seeded) return;
    const entry = this.captureEntry();
    if (!entry) return;
    this.kept = true;
    this.keptOffset = entry.time?.offsetSeconds;
    this.lastDriftCheckMs = entry.savedAt;
    try {
      await this.store.save(this.profileId(), entry);
    } catch {
      // --- A clock that could not be saved stays as it is; the next change tries again
    }
  }

  private applyEntry(ex: NextRtcExports, entry: NextRtcKeptEntry): void {
    const regs = entry.time ? rtcTargetRegisters(entry.time, this.now()) : entry.regs;
    ex.zxnextRtcSetTime(...regs.slice(0, 7).map((r) => r & 0xff));
    ex.zxnextRtcSetRegister(7, entry.control & 0xff);
    for (let i = 0; i < RAM_SIZE; i++) ex.zxnextRtcSetRegister(RAM_FIRST + i, (entry.ram[i] ?? 0) & 0xff);
    if (this.mode === "host" && entry.time) this.clock = { ...entry.time };
  }

  private readTime(ex: NextRtcExports): number[] {
    const regs: number[] = [];
    for (let i = 0; i < 7; i++) regs.push(ex.zxnextRtcPeekRegister(i) & 0xff);
    return regs;
  }

  /** A host-following clock takes its offset from what the registers show now */
  private takeClockFromRegisters(): void {
    const ex = this.exports();
    if (!ex) return;
    const regs = this.readTime(ex);
    this.clock = (regs[0] & 0x80) === 0 ? rtcStateOf(regs, this.now()) : undefined;
  }

  /** Rewrites registers 0-6 when they are a second or more away from host time + offset (D4) */
  private syncWithHost(ex: NextRtcExports, now: number): void {
    const regs = this.readTime(ex);
    // --- A stopped oscillator (CH) stays as the program left it
    if (regs[0] & 0x80) return;
    if (!this.clock) {
      this.clock = rtcStateOf(regs, now);
      if (!this.clock) return;
    }
    const target = rtcTargetRegisters(this.clock, now);
    if (target.some((value, i) => value !== regs[i])) ex.zxnextRtcSetTime(...target);
  }
}
