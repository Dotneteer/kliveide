/*
 * The historical-state provider of full reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` D10):
 * G4.3's history cursor chooses where to go, and this puts the machine there by replay. Every panel
 * then shows the past - memory, devices, the screen - because the machine *is* in the past, and the
 * "memory shows the present" banners go (`memoryIsHistorical`).
 */

import type { HistoryReplayHook } from "../history/HistoryCursor";
import { ReplayError } from "./ReplayEngine";
import type { Timeline } from "./Timeline";

/** What the provider needs of the machine: its live PC and SP */
export type ReplayProviderMachine = { readonly pc: number; readonly sp: number };

export class ReplayStateProvider implements HistoryReplayHook {
  /** The present's PC and SP: the walkers need them, and in the past the machine's are the past's */
  private presentRegs?: { pc: number; sp: number };
  /** Why the last `enter` failed, for the IDE to tell the user */
  lastError?: string;

  constructor(
    private readonly timeline: () => Timeline | undefined,
    private readonly machine: ReplayProviderMachine
  ) {}

  get inPast(): boolean {
    const mode = this.timeline()?.mode;
    return mode === "navigating" || mode === "replaying";
  }

  /** The present's PC (the machine's own at the present) */
  get presentPc(): number {
    return this.presentRegs?.pc ?? this.machine.pc;
  }

  get presentSp(): number {
    return this.presentRegs?.sp ?? this.machine.sp;
  }

  enter(sequence: number): boolean {
    const timeline = this.timeline();
    if (!timeline || timeline.mode === "replaying") return false;
    if (timeline.mode === "live") this.presentRegs = { pc: this.machine.pc, sp: this.machine.sp };
    try {
      timeline.navigateTo(sequence);
      this.lastError = undefined;
      return true;
    } catch (err) {
      // --- Before the timeline's start (the budget evicted it), or a desync that ended the timeline
      this.lastError = err instanceof Error ? err.message : String(err);
      if (err instanceof ReplayError || err instanceof RangeError) return false;
      throw err;
    }
  }

  leave(): void {
    const timeline = this.timeline();
    if (timeline?.mode === "navigating") timeline.returnToPresent();
    if (!this.inPast) this.presentRegs = undefined;
  }

  /**
   * The machine landed beyond the present's ring (D15): the history views' ring ends where it stands,
   * so the walkers start from its own PC and SP
   */
  anchorHere(): void {
    this.presentRegs = { pc: this.machine.pc, sp: this.machine.sp };
  }

  /** The timeline went live by itself (a replay run reached the present, or a fork) */
  forgetPresent(): void {
    this.presentRegs = undefined;
  }
}
