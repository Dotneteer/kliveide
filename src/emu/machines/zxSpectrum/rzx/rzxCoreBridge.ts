/*
 * The TypeScript side of the RZX core module (`zx-spectrum-rzx.c`, `.plans/RZX_PLAN.md` §4.2–4.3).
 * The 48K, 128K and +2E/+3E cores export the same functions under their own prefix
 * (`sp48RzxSetMode`, `sp128RzxSetMode`, `spp3eRzxSetMode`); the bridge addresses them through it, as
 * `spectrumSnapshotRestore.ts` does. `scripts/rzx-core-exports.cjs` keeps the build side of the list.
 */

import type { RzxFrame } from "@common/spectrum/rzx/rzxModel";

/** The export names without the core's prefix */
export const RZX_EXPORT_SUFFIXES = [
  "RzxSetMode",
  "RzxGetMode",
  "RzxPlayBufferPtr",
  "RzxPlayBufferCapacity",
  "RzxSetPlayFrame",
  "RzxGetStatus",
  "RzxGetFetchCount",
  "RzxGetReadIndex",
  "RzxRecBufferPtr",
  "RzxRecBufferCapacity",
  "RzxRecFrameTablePtr",
  "RzxGetRecFrameCount",
  "RzxGetRecByteCount",
  "RzxGetOverflow",
  "RzxClearRec",
  "RzxRecMarkBlockStart",
  "RzxGetRecClosePending",
  "RzxSetFrameTact"
] as const;

export type RzxExportSuffix = (typeof RZX_EXPORT_SUFFIXES)[number];

/** The RZX exports of a core with the given prefix */
export type RzxCoreExports<P extends string> = {
  [K in RzxExportSuffix as `${P}${K}`]: (...args: number[]) => number;
};

/** The RZX export names of a core, for its loader's required-export list */
export function rzxCoreExportNames<P extends string>(prefix: P): `${P}${RzxExportSuffix}`[] {
  return RZX_EXPORT_SUFFIXES.map((suffix) => `${prefix}${suffix}` as `${P}${RzxExportSuffix}`);
}

export const RZX_MODE_OFF = 0;
export const RZX_MODE_PLAY = 1;
export const RZX_MODE_RECORD = 2;

export const RZX_STATUS_OK = 0;
/** The frame's fetch count is reached: the host supplies the next frame */
export const RZX_STATUS_FRAME_DONE = 1;
/** The program read more INs than the frame recorded */
export const RZX_STATUS_DESYNC_OVER = 2;
/** The frame ended with recorded INs left unread */
export const RZX_STATUS_DESYNC_UNDER = 3;

export type RzxCorePrefix = "sp48" | "sp128" | "spp3e";

type CoreFunctions = Record<string, (...args: number[]) => number>;

/** Drives a core's RZX module */
export class RzxCoreBridge {
  private readonly fns: CoreFunctions;

  constructor(
    readonly prefix: RzxCorePrefix,
    exports: object,
    private readonly memory: WebAssembly.Memory
  ) {
    this.fns = exports as CoreFunctions;
  }

  private call(suffix: RzxExportSuffix, ...args: number[]): number {
    const fn = this.fns[this.prefix + suffix];
    if (typeof fn !== "function") {
      throw new Error(`The ${this.prefix} core has no ${this.prefix + suffix} export`);
    }
    return (fn(...args) as number) ?? 0;
  }

  /** The current mode: RZX_MODE_* */
  get mode(): number {
    return this.call("RzxGetMode");
  }

  setMode(mode: number): void {
    this.call("RzxSetMode", mode);
  }

  /** The playback status: RZX_STATUS_* */
  get status(): number {
    return this.call("RzxGetStatus");
  }

  /** Fetches counted in the current frame */
  get fetchCount(): number {
    return this.call("RzxGetFetchCount");
  }

  /** INs the program has read in the current playback frame */
  get readIndex(): number {
    return this.call("RzxGetReadIndex");
  }

  /**
   * Starts the next playback frame
   * @param raiseInt The previous frame ended here, so its interrupt is raised first
   */
  supplyFrame(frame: RzxFrame, raiseInt: boolean): void {
    const capacity = this.call("RzxPlayBufferCapacity");
    if (frame.ins.length > capacity) {
      throw new Error(`An RZX frame holds ${frame.ins.length} IN values; the core takes at most ${capacity}`);
    }
    new Uint8Array(this.memory.buffer, this.call("RzxPlayBufferPtr"), frame.ins.length).set(frame.ins);
    this.call("RzxSetPlayFrame", frame.fetchCount, frame.ins.length, raiseInt ? 1 : 0);
  }

  /** Puts the machine at a tact of its frame (an input block's T-state field, trap 11) */
  setFrameTact(tact: number): void {
    this.call("RzxSetFrameTact", tact >>> 0);
  }

  /** Reads and drops the frames the core closed while recording */
  drainRecordedFrames(): RzxFrame[] {
    const count = this.call("RzxGetRecFrameCount");
    if (count === 0) return [];
    const table = new Uint32Array(this.memory.buffer, this.call("RzxRecFrameTablePtr"), count * 2);
    const bytes = new Uint8Array(this.memory.buffer, this.call("RzxRecBufferPtr"), this.call("RzxGetRecByteCount"));
    const frames: RzxFrame[] = [];
    let offset = 0;
    for (let i = 0; i < count; i++) {
      const inCount = table[i * 2 + 1];
      frames.push({ fetchCount: table[i * 2], ins: bytes.slice(offset, offset + inCount) });
      offset += inCount;
    }
    this.call("RzxClearRec");
    return frames;
  }

  /** The recording buffers overflowed: the core stopped recording at the last complete frame */
  get overflow(): boolean {
    return this.call("RzxGetOverflow") !== 0;
  }

  /** A ULA frame ended, but its RZX frame waits for an instruction boundary to close */
  get closePending(): boolean {
    return this.call("RzxGetRecClosePending") !== 0;
  }

  /** A new input block starts at this point (an autosave or a rollback) */
  markBlockStart(): void {
    this.call("RzxRecMarkBlockStart");
  }
}
