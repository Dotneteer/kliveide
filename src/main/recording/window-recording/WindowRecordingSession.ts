import type { IRecordingBackend } from "../IRecordingBackend";
import type { RecordingFormat } from "@common/state/AppState";
import type { IdePosition, Rect, Size, WindowLayout } from "./layout";
import { computeLayout } from "./layout";
import type { CaptureTarget } from "./WindowFrameSource";
import { WindowFrameSource } from "./WindowFrameSource";
import type { ComposerColors, PointerOverlay, SourcePicture } from "./FrameComposer";
import { FrameComposer } from "./FrameComposer";
import type { MouseButton } from "./ClickTracker";
import { ClickTracker } from "./ClickTracker";
import { AudioPadder } from "./AudioPadder";

/**
 * One IDE + Emulator recording (plan §3, §4).
 *
 * Paced by the wall clock: every tick works out how many video frames are due since the start and
 * writes that many, repeating the latest composed frame, so the video always has the right length.
 * While FFmpeg's input is backed up, no new frame is composed (memory stays bounded); once it drains,
 * the frames that fell due meanwhile are written as repeats of one fresh frame.
 *
 * Everything Electron-specific comes in through `RecordedWindow` and `SessionClock`, so the session
 * can be tested with fakes.
 */

/** One recorded window, as the session sees it */
export interface RecordedWindow {
  readonly capture: CaptureTarget;
  /** The page content's bounds on the screen, in DIP */
  getContentBounds(): Rect;
  /** The display's scale factor (device pixels per DIP) */
  getScaleFactor(): number;
  isFocused(): boolean;
  isDestroyed(): boolean;
  /** Mouse button events on the page; returns the unsubscribe function */
  onMouseButton(callback: (button: MouseButton, down: boolean) => void): () => void;
  /** Focus loss; returns the unsubscribe function */
  onBlur(callback: () => void): () => void;
  /** The window was closed; returns the unsubscribe function */
  onClosed(callback: () => void): () => void;
}

export interface SessionClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type WindowRecordingOptions = {
  outputPath: string;
  idePosition: IdePosition;
  /** Draw the mouse pointer */
  pointer: boolean;
  /** Draw mouse clicks (only with `pointer`) */
  clicks: boolean;
  /** Record at the display's full pixel density instead of 1x */
  hiDpi: boolean;
  fps: number;
  crf: number;
  format: RecordingFormat;
  sampleRate: number;
  colors: ComposerColors;
};

export type WindowRecordingDeps = {
  backend: IRecordingBackend;
  ide: RecordedWindow;
  emu: RecordedWindow;
  clock: SessionClock;
  /** The pointer's screen position in DIP */
  cursor(): { x: number; y: number };
  /** True while the emulator holds the mouse (Pointer Lock): no pointer, no clicks */
  mouseCaptured(): boolean;
  /** Called when the session ends by itself (a window closed) */
  onAborted?(): void;
};

/** The longest wait for both windows' first frames before the clock starts anyway */
export const FIRST_FRAME_TIMEOUT_MS = 1000;
/** Frames written before the clock starts, to get past the encoder's start-up (see `_prime`) */
export const PRIMING_FRAMES = 2;
/** A press is cleared when the pointer has been outside both windows this long */
export const POINTER_AWAY_RESET_MS = 1000;

type Slot = { window: RecordedWindow; source: WindowFrameSource; slot: Rect; scale: number };

export class WindowRecordingSession {
  readonly layout: WindowLayout;
  private readonly _composer: FrameComposer;
  private readonly _ide: Slot;
  private readonly _emu: Slot;
  private readonly _clicks = new ClickTracker();
  private readonly _padder: AudioPadder;
  private _unsubscribers: (() => void)[] = [];
  private _timer: unknown = null;
  private _createdAt = 0;
  private _startedAt: number | null = null;
  private _priming = false;
  private _framesWritten = 0;
  private _busy = false;
  private _running = false;
  private _stopped = false;
  private _pointerAwaySince: number | null = null;
  private _free: Uint8Array[] = [];
  private _repeats = 0;

  constructor(
    readonly options: WindowRecordingOptions,
    private readonly deps: WindowRecordingDeps
  ) {
    const ideScale = options.hiDpi ? deps.ide.getScaleFactor() : 1;
    const emuScale = options.hiDpi ? deps.emu.getScaleFactor() : 1;
    const ideBounds = deps.ide.getContentBounds();
    const emuBounds = deps.emu.getContentBounds();
    const ideSize: Size = { width: ideBounds.width * ideScale, height: ideBounds.height * ideScale };
    const emuSize: Size = { width: emuBounds.width * emuScale, height: emuBounds.height * emuScale };
    this.layout = computeLayout(ideSize, emuSize, options.idePosition);
    this._composer = new FrameComposer(this.layout, options.colors);
    this._ide = { window: deps.ide, source: new WindowFrameSource(deps.ide.capture), slot: this.layout.ide, scale: ideScale };
    this._emu = { window: deps.emu, source: new WindowFrameSource(deps.emu.capture), slot: this.layout.emu, scale: emuScale };
    this._padder = new AudioPadder(options.sampleRate);
  }

  /** Video frames written so far */
  get framesWritten(): number {
    return this._framesWritten;
  }

  /** Video frames written as repeats while the encoder was backed up */
  get repeatedFrames(): number {
    return this._repeats;
  }

  get isRunning(): boolean {
    return this._running;
  }

  start(): void {
    if (this._running || this._stopped) return;
    const o = this.options;
    this.deps.backend.start(o.outputPath, this.layout.width, this.layout.height, o.fps, 1, 1, o.sampleRate, o.crf, o.format, {
      pixelFormat: "bgra",
      realtime: true
    });
    this._running = true;
    this._createdAt = this.deps.clock.now();

    for (const slot of [this._ide, this._emu]) {
      slot.source.start();
      this._unsubscribers.push(slot.window.onClosed(() => this._abort()));
      if (o.pointer && o.clicks) {
        this._unsubscribers.push(
          slot.window.onMouseButton((button, down) => this._mouseButton(button, down)),
          slot.window.onBlur(() => this._clicks.reset())
        );
      }
    }
    this._schedule();
  }

  /**
   * Accepts emulator sound (interleaved stereo f32). Sound before the clock starts is dropped; sound
   * running ahead of the clock is trimmed (§4.5).
   */
  appendAudio(samples: Float32Array): void {
    if (!this._running || this._startedAt === null) return;
    const accepted = this._padder.accept(samples, this.deps.clock.now() - this._startedAt);
    if (accepted.length > 0) this.deps.backend.appendAudioSamples(accepted);
  }

  /** Ends the recording and finalises the file; returns its path */
  async stop(): Promise<string> {
    this._halt();
    return this.deps.backend.finish();
  }

  // ---------------------------------------------------------------------------

  private _abort(): void {
    if (!this._running) return;
    this.deps.onAborted?.();
  }

  private _halt(): void {
    this._running = false;
    this._stopped = true;
    if (this._timer !== null) {
      this.deps.clock.clearTimeout(this._timer);
      this._timer = null;
    }
    for (const unsubscribe of this._unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // --- The window may already be gone
      }
    }
    this._unsubscribers = [];
    this._ide.source.stop();
    this._emu.source.stop();
    this._clicks.reset();
  }

  private _mouseButton(button: MouseButton, down: boolean): void {
    if (down) this._clicks.mouseDown(button);
    else this._clicks.mouseUp(button, this.deps.clock.now());
  }

  private _schedule(): void {
    if (!this._running) return;
    const interval = 1000 / this.options.fps;
    let delay = interval;
    if (this._startedAt !== null && !this._busy) {
      // --- Aim at the next frame boundary, so late ticks do not drift the cadence. While the
      // --- encoder is backed up, nothing can be written anyway: keep the plain interval.
      const elapsed = this.deps.clock.now() - this._startedAt;
      delay = Math.min(interval, Math.max(1, this._framesWritten * interval - elapsed));
    }
    this._timer = this.deps.clock.setTimeout(() => {
      this._timer = null;
      this.tick();
      this._schedule();
    }, delay);
  }

  /** One clock tick: start the clock when ready, pad audio, write the frames that are due */
  tick(): void {
    if (!this._running) return;
    const now = this.deps.clock.now();

    if (this._startedAt === null) {
      this._prime(now);
      return;
    }

    const elapsed = now - this._startedAt;
    const silence = this._padder.padding(elapsed);
    if (silence) this.deps.backend.appendAudioSamples(silence);

    const due = Math.floor((elapsed * this.options.fps) / 1000) + 1;
    if (this._framesWritten >= due || this._busy) return;

    const frame = this._compose(now);
    const count = due - this._framesWritten;
    let pending = count;
    const release = () => {
      if (--pending === 0) this._free.push(frame);
    };
    let flowing = true;
    for (let i = 0; i < count; i++) {
      flowing = this.deps.backend.appendFrame(frame, release);
    }
    this._repeats += count - 1;
    this._framesWritten = due;
    if (!flowing) {
      this._busy = true;
      this.deps.backend.onceDrained(() => {
        this._busy = false;
      });
    }
  }

  /**
   * Before the clock starts: once both windows have painted (or the wait timed out), write
   * `PRIMING_FRAMES` frames and start the clock only when the encoder has taken the last of them.
   *
   * FFmpeg reads the first frame at once, then sets its encoder up on it - about a second, during
   * which it reads nothing more. A clock started before that would open every video with a second
   * of repeats of the first frame. The second frame is taken only once the encoder runs, whatever
   * the codec, so it marks the real start. The priming frames count as the first frames of the
   * video; the clock is set back accordingly.
   */
  private _prime(now: number): void {
    if (this._priming) return;
    const ready = this._ide.source.hasFrame && this._emu.source.hasFrame;
    if (!ready && now - this._createdAt < FIRST_FRAME_TIMEOUT_MS) return;
    this._priming = true;
    // --- Sound for the priming frames first: FFmpeg interleaves its inputs, and would otherwise
    // --- wait on the audio pipe instead of taking the video frames the clock waits for
    const interval = 1000 / this.options.fps;
    this.deps.backend.appendAudioSamples(this._padder.prefill(PRIMING_FRAMES * interval));
    const frame = this._compose(now);
    let pending = PRIMING_FRAMES;
    const release = () => {
      if (--pending === 0) this._free.push(frame);
    };
    const begin = () => {
      this._priming = false;
      if (!this._running || this._startedAt !== null) return;
      // --- The last priming frame is frame PRIMING_FRAMES - 1, shown from this moment on
      this._startedAt = this.deps.clock.now() - (PRIMING_FRAMES - 1) * interval;
    };
    const writeNext = () => {
      if (!this._running) return;
      const flowing = this.deps.backend.appendFrame(frame, release);
      this._framesWritten++;
      if (this._framesWritten >= PRIMING_FRAMES) {
        if (flowing) begin();
        else this.deps.backend.onceDrained(begin);
      } else if (flowing) {
        writeNext();
      } else {
        this.deps.backend.onceDrained(writeNext);
      }
    };
    writeNext();
  }

  private _takeBuffer(): Uint8Array {
    const bytes = this._composer.frameBytes;
    while (this._free.length > 0) {
      const buffer = this._free.pop()!;
      if (buffer.length === bytes) return buffer;
    }
    // --- A Buffer of its own (not from the shared pool), so its offset is 0 and Uint32-aligned
    return Buffer.allocUnsafeSlow(bytes);
  }

  private _compose(now: number): Uint8Array {
    const out = this._takeBuffer();
    const ide = this._picture(this._ide);
    const emu = this._picture(this._emu);
    this._composer.compose(out, ide, emu, this._pointer(now, ide, emu));
    return out;
  }

  private _picture(slot: Slot): SourcePicture | undefined {
    return slot.source.picture(slot.slot);
  }

  private _pointer(now: number, ide?: SourcePicture, emu?: SourcePicture): PointerOverlay | undefined {
    const o = this.options;
    if (!o.pointer) return undefined;
    if (this.deps.mouseCaptured()) {
      this._clicks.reset();
      return undefined;
    }
    const cursor = this.deps.cursor();
    const candidates: { slot: Slot; picture: SourcePicture }[] = [];
    if (ide) candidates.push({ slot: this._ide, picture: ide });
    if (emu) candidates.push({ slot: this._emu, picture: emu });
    // --- When the windows overlap on the screen, the focused one is assumed to be on top
    candidates.sort((a, b) => Number(b.slot.window.isFocused()) - Number(a.slot.window.isFocused()));

    for (const { slot, picture } of candidates) {
      if (slot.window.isDestroyed()) continue;
      const bounds = slot.window.getContentBounds();
      if (bounds.width <= 0 || bounds.height <= 0) continue;
      const lx = cursor.x - bounds.x;
      const ly = cursor.y - bounds.y;
      if (lx < 0 || ly < 0 || lx >= bounds.width || ly >= bounds.height) continue;
      this._pointerAwaySince = null;
      const place = this._composer.placement(picture, slot.slot);
      const scale = place.width / bounds.width;
      return {
        x: place.x + lx * scale,
        y: place.y + ly * scale,
        scale,
        clip: place,
        click: o.clicks ? this._clicks.frame(now) : undefined
      };
    }

    // --- Outside both windows: no pointer; a press that never got its release is dropped
    if (this._pointerAwaySince === null) this._pointerAwaySince = now;
    else if (now - this._pointerAwaySince >= POINTER_AWAY_RESET_MS) this._clicks.reset();
    return undefined;
  }
}
