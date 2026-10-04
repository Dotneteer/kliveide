/*
 * Plays an RZX file on a ZX Spectrum machine (`.plans/RZX_PLAN.md` §4.3, D8, D10–D12).
 *
 * The player walks the file's segments. At a segment's start it loads the snapshot with
 * `loadSnapshotState` - a normal transition that does not end playback - puts the core into PLAY,
 * sets the frame tact from the input block's T-state field (trap 11), and starts the first frame
 * without an interrupt. Each later frame starts with the interrupt that ended the one before it
 * (D8: the core decides whether it is accepted).
 *
 * It stops when the recording ends (D12) or desyncs (D11), and when the IDE changes the machine
 * from outside the CPU (trap 4).
 */

import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { isPictureFrame, rzxCreatorText, type RzxFile, type RzxFrame } from "@common/spectrum/rzx/rzxModel";
import { rzxSegments, type RzxSegment } from "@common/spectrum/rzx/rzxSegments";
import {
  RZX_MODE_OFF,
  RZX_MODE_PLAY,
  RZX_STATUS_DESYNC_OVER,
  RZX_STATUS_DESYNC_UNDER,
  RZX_STATUS_FRAME_DONE,
  RZX_STATUS_OK
} from "./rzxCoreBridge";
import type { IRzxMachine, IRzxSession, RzxInstructionResult, RzxStop } from "./rzxSession";

/** What a desync looked like */
export type RzxDesync = {
  /** 1-based frame number over the whole file */
  frame: number;
  /** IN values the frame recorded */
  expected: number;
  /** IN values the program read (for an overrun: at least this many) */
  actual: number;
  over: boolean;
};

export type RzxPlayerOptions = {
  /** The segment to start at (Play from this segment); defaults to 0 */
  segment?: number;
  /** The file name, for the messages */
  fileName?: string;
};

export class RzxPlayer implements IRzxSession {
  readonly mode = "play" as const;
  readonly segments: RzxSegment[];
  readonly frames: number;
  private segmentIndex = -1;
  private blockIndex = 0;
  private frameIndex = 0;
  private current?: RzxFrame;
  private played = 0;
  private stopInfo?: RzxStop;
  private reported = false;
  desync?: RzxDesync;

  constructor(
    private readonly machine: IRzxMachine,
    readonly file: RzxFile,
    private readonly options: RzxPlayerOptions = {}
  ) {
    this.segments = rzxSegments(file);
    this.frames = this.segments.reduce((sum, s) => sum + s.frameCount, 0);
  }

  get active(): boolean {
    return this.stopInfo === undefined;
  }

  /** Frames started so far, over the whole file (the first frame of the start segment counts) */
  get frame(): number {
    return this.played;
  }

  get stop(): RzxStop | undefined {
    return this.stopInfo;
  }

  /** The segment playing now */
  get segment(): RzxSegment | undefined {
    return this.segments[this.segmentIndex];
  }

  /** Loads the start segment's snapshot and supplies its first frame */
  start(): void {
    const index = this.options.segment ?? 0;
    if (index < 0 || index >= this.segments.length) {
      throw new Error(`The recording has no segment ${index + 1}`);
    }
    this.played = this.segments[index].firstFrame;
    this.enterSegment(index);
  }

  runFastFrame(executeFrame: () => void): boolean {
    // --- Short (EI and retrigger) frames complete no picture: play on until one does
    for (;;) {
      if (!this.beforeInstruction()) return false;
      executeFrame();
      const status = this.machine.rzxCore.status;
      if (status === RZX_STATUS_FRAME_DONE) {
        if (this.current && isPictureFrame(this.current)) return true;
        continue;
      }
      if (status !== RZX_STATUS_OK) {
        this.onDesync(status);
        return false;
      }
    }
  }

  beforeInstruction(): boolean {
    if (!this.active) return false;
    if (this.machine.rzxCore.status !== RZX_STATUS_FRAME_DONE) return true;
    return this.advance();
  }

  afterInstruction(): RzxInstructionResult {
    const status = this.machine.rzxCore.status;
    if (status === RZX_STATUS_OK) return "ran";
    if (status === RZX_STATUS_FRAME_DONE) {
      return this.current && isPictureFrame(this.current) ? "picture" : "boundary";
    }
    this.onDesync(status);
    return "stopped";
  }

  afterRun(): boolean {
    return this.active;
  }

  interrupt(reason: string): void {
    if (!this.active) return;
    this.finish({
      kind: "interrupted",
      frame: this.played,
      message: `RZX playback stopped at frame ${this.played} of ${this.frames}: ${reason}`
    });
  }

  takeStop(): RzxStop | undefined {
    if (!this.stopInfo || this.reported) return undefined;
    this.reported = true;
    return this.stopInfo;
  }

  // --------------------------------------------------------------------------------------------

  /** Moves to the next frame, the next block or the next segment */
  private advance(): boolean {
    const segment = this.segments[this.segmentIndex];
    const block = segment.inputs[this.blockIndex];
    if (this.frameIndex + 1 < block.frames.length) {
      this.frameIndex++;
      this.supply(true);
      return true;
    }
    // --- The next block of the segment continues from the same state
    for (let b = this.blockIndex + 1; b < segment.inputs.length; b++) {
      if (segment.inputs[b].frames.length > 0) {
        this.blockIndex = b;
        this.frameIndex = 0;
        this.supply(true);
        return true;
      }
    }
    // --- The next segment starts from its own snapshot
    for (let s = this.segmentIndex + 1; s < this.segments.length; s++) {
      if (this.segments[s].frameCount > 0) {
        this.enterSegment(s);
        return this.active;
      }
    }
    this.finish({
      kind: "ended",
      frame: this.played,
      message: `RZX playback ended after ${this.frames} frames${this.fileText()}; the machine is paused (resume to continue live)`
    });
    return false;
  }

  private enterSegment(index: number): void {
    const segment = this.segments[index];
    const core = this.machine.rzxCore;
    // --- Loading resets the machine; the core is in PLAY again before the first frame
    core.setMode(RZX_MODE_OFF);
    const snapshot = parseSpectrumSnapshot(`segment.${segment.snapshot.extension}`, segment.snapshot.bytes);
    this.machine.loadSnapshotState(snapshot);
    core.setMode(RZX_MODE_PLAY);
    this.segmentIndex = index;
    this.blockIndex = segment.inputs.findIndex((b) => b.frames.length > 0);
    this.frameIndex = 0;
    if (this.blockIndex < 0) {
      this.finish({ kind: "ended", frame: this.played, message: "RZX playback ended: the segment has no frames" });
      return;
    }
    core.setFrameTact(segment.inputs[this.blockIndex].tstates);
    this.supply(false);
  }

  private supply(raiseInt: boolean): void {
    const frame = this.segments[this.segmentIndex].inputs[this.blockIndex].frames[this.frameIndex];
    this.current = frame;
    this.played++;
    this.machine.rzxCore.supplyFrame(frame, raiseInt);
  }

  private onDesync(status: number): void {
    const expected = this.current?.ins.length ?? 0;
    const over = status === RZX_STATUS_DESYNC_OVER;
    const actual = over ? expected + 1 : status === RZX_STATUS_DESYNC_UNDER ? this.machine.rzxCore.readIndex : expected;
    this.desync = { frame: this.played, expected, actual, over };
    const read = over ? `more than ${expected}` : `${actual}`;
    this.finish({
      kind: "desync",
      frame: this.played,
      message:
        `RZX playback desynced at frame ${this.played} of ${this.frames}${this.fileText()}: ` +
        `the program read ${read} IN values where the recording has ${expected} ` +
        `(recorded by ${rzxCreatorText(this.file.creator)}). ` +
        `The machine is paused at the instruction that desynced; resume to continue live.`
    });
  }

  private finish(stop: RzxStop): void {
    if (this.stopInfo) return;
    this.stopInfo = stop;
    this.machine.rzxCore.setMode(RZX_MODE_OFF);
  }

  private fileText(): string {
    return this.options.fileName ? ` (${this.options.fileName})` : "";
  }
}
