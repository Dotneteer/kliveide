import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/** 28 MHz clocks in one second: the machine paces wall-clock time by them (Z80NMachineBase). */
export const CLOCK28_PER_SECOND = 28_000_000;

/**
 * A running count of the machine's 28 MHz clock (frames * tactsInFrame + frameTacts) for devices that
 * keep time between frames lazily (the UARTs, the DS1307). A reset restarts the frame without
 * completing it, so the count is kept monotonic: it never goes backwards. zxnext-clock28.c is the WASM
 * counterpart.
 */
export class Clock28 {
  private _base = 0;
  private _seenFrames = 0;
  private _last = 0;

  constructor(private readonly machine: IZxNextMachine) {}

  now(): number {
    const m = this.machine;
    if (m.frames !== this._seenFrames) {
      if (m.frames > this._seenFrames) this._base += (m.frames - this._seenFrames) * m.tactsInFrame;
      this._seenFrames = m.frames;
    }
    let t = this._base + m.frameTacts;
    if (t < this._last) {
      this._base += this._last - t;
      t = this._last;
    }
    this._last = t;
    return t;
  }
}
