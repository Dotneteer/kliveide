import type { MainApi } from "@common/messaging/MainApi";
import type {
  RecordingFps,
  RecordingQuality,
  RecordingFormat,
  ScreenRecordingState
} from "@common/state/AppState";
import {
  setScreenRecordingQualityAction,
  setScreenRecordingFormatAction,
  setScreenRecordingStateAction
} from "@common/state/actions";

type Dispatch = (action: any) => void;

/**
 * The surround recorded around a picture that has no border of its own, in machine pixels.
 *
 * The emulator display frames such a picture (the Cambridge Z88's LCD) in its own colour so its
 * rounded corners never clip picture pixels. A recording needs the same: macOS players show video
 * in windows with rounded corners, and a Z88 recording, LCD to the edge, lost its corners there
 * (issue #1374). Four pixels is what the issue asked for; with the frame's even width and height it
 * keeps the dimensions even, as the encoders want.
 */
export const RECORDING_SURROUND = 4;

/**
 * Framework-agnostic state machine that coordinates screen recording.
 *
 * Lifecycle:
 *   idle ──arm()──► armed ──onMachineRunning()──► recording ──onMachinePaused()──► paused
 *                                                    │                                 │
 *                                                    └────────onMachineRunning()───────┘
 *   idle ◄──disarm() / onMachineStopped()──────────────────────────────────────────────┘
 *
 * inject `mainApi` and `dispatch` via the constructor — no React dependency.
 */
export class RecordingManager {
  private _state: ScreenRecordingState = "idle";
  private _fps: RecordingFps = "native";
  private _quality: RecordingQuality = "good";
  private _format: RecordingFormat = "mp4";
  private _width = 0;
  private _height = 0;
  private _nativeFps = 0;
  private _xRatio = 1;
  private _yRatio = 1;
  private _sampleRate = 44100;
  private _captureCount = 0; // increments every submitFrame call; used for half-fps skipping
  /** The machine's surround colour (ABGR, as its pixel buffer), when its picture has no border */
  private _surroundColor: (() => number | undefined) | undefined;
  /** The frame with its surround, reused from frame to frame */
  private _surroundFrame: Uint8Array | undefined;

  constructor(
    private readonly mainApi: MainApi,
    private readonly dispatch: Dispatch
  ) {}

  get state(): ScreenRecordingState {
    return this._state;
  }

  // ---------------------------------------------------------------------------
  // User controls
  // ---------------------------------------------------------------------------

  /**
   * Sets the fps preference without starting a recording.
   * Updates Redux so the menu checkbox reflects the choice immediately.
   */
  setFpsPreference(fps: RecordingFps): void {
    this._fps = fps;
    // Keep current recording state, just update the fps field in Redux.
    this.dispatch(setScreenRecordingStateAction(this._state, undefined, fps));
  }

  /**
   * Sets the quality preference without starting a recording.
   * Updates Redux so the menu radio items reflect the choice immediately.
   */
  setQualityPreference(quality: RecordingQuality): void {
    this._quality = quality;
    this.dispatch(setScreenRecordingQualityAction(quality));
  }

  /**
   * Sets the format preference without starting a recording.
   * Updates Redux so the menu radio items reflect the choice immediately.
   */
  setFormatPreference(format: RecordingFormat): void {
    this._format = format;
    this.dispatch(setScreenRecordingFormatAction(format));
  }

  /**
   * Arms the recorder. Recording begins when the machine next starts running.
   * Uses the stored fps preference when called without an argument.
   * No-op if not idle.
   */
  arm(fps?: RecordingFps, startNow = false): void {
    if (fps !== undefined) this._fps = fps;
    if (this._state !== "idle") return;
    this._state = "armed";
    this.dispatch(setScreenRecordingStateAction("armed", undefined, this._fps));
    // If the machine is already running and we have valid dimensions, start immediately.
    if (startNow && this._width > 0 && this._height > 0) {
      void this._startRecording();
    }
  }

  /**
   * Stops or cancels the recording. Stops an active recording session if one
   * is in progress. No-op if already idle.
   */
  async disarm(): Promise<void> {
    if (this._state === "idle") return;
    if (this._state === "recording" || this._state === "paused") {
      await this._stopRecording();
    } else {
      // armed but machine never ran
      this._state = "idle";
      this.dispatch(setScreenRecordingStateAction("idle"));
    }
  }

  // ---------------------------------------------------------------------------
  // Machine lifecycle hooks — called by EmulatorPanel
  // ---------------------------------------------------------------------------

  /**
   * Called whenever the machine transitions to the Running state (first start
   * or resume after pause).
   */
  async onMachineRunning(
    width: number,
    height: number,
    nativeFps: number,
    xRatio = 1,
    yRatio = 1,
    sampleRate = 44100,
    /**
     * The machine's `getScreenSurroundColor`, when its picture has no border of its own. The
     * recording then carries a RECORDING_SURROUND-pixel surround in that colour, read per frame.
     */
    surroundColor?: () => number | undefined
  ): Promise<void> {
    this._width = width;
    this._height = height;
    this._surroundColor = surroundColor;
    this._surroundFrame = undefined;
    this._nativeFps = nativeFps;
    this._xRatio = xRatio;
    this._yRatio = yRatio;
    this._sampleRate = sampleRate;

    if (this._state === "armed") {
      await this._startRecording();
    } else if (this._state === "paused") {
      this._state = "recording";
      this.dispatch(setScreenRecordingStateAction("recording"));
    }
  }

  /**
   * Called when the machine transitions to the Paused state.
   * Frame submission stops; the file stays open.
   */
  onMachinePaused(): void {
    if (this._state !== "recording") return;
    this._state = "paused";
    this.dispatch(setScreenRecordingStateAction("paused"));
  }

  /**
   * Manually pauses an active recording (does not pause the machine).
   * No-op if not currently recording.
   */
  pauseRecording(): void {
    if (this._state !== "recording") return;
    this._state = "paused";
    this.dispatch(setScreenRecordingStateAction("paused"));
  }

  /**
   * Resumes a manually-paused recording (the machine keeps running).
   * No-op if not currently paused.
   */
  resumeRecording(): void {
    if (this._state !== "paused") return;
    this._state = "recording";
    this.dispatch(setScreenRecordingStateAction("recording"));
  }

  /**
   * Called when the machine transitions to the Stopped state.
   * Finalises and closes the recording file if active.
   */
  async onMachineStopped(): Promise<void> {
    if (this._state === "armed") {
      this._state = "idle";
      this.dispatch(setScreenRecordingStateAction("idle"));
      return;
    }
    if (this._state === "recording" || this._state === "paused") {
      await this._stopRecording();
    }
  }

  // ---------------------------------------------------------------------------
  // Frame submission — called by EmulatorPanel on every display frame
  // ---------------------------------------------------------------------------

  /**
   * Submits a raw RGBA frame to the recording.
   * @param rgba Raw RGBA pixel data at machine resolution (width × height × 4 bytes).
   */
  async submitFrame(rgba: Uint8Array): Promise<void> {
    if (this._state !== "recording") return;
    this._captureCount++;
    // For half fps, skip odd-numbered capture frames
    if (this._fps === "half" && this._captureCount % 2 !== 0) return;
    await this.mainApi.appendRecordingFrame(this._withSurround(rgba));
  }

  /** The frame as recorded: the picture itself, or the picture inside its surround */
  private _withSurround(rgba: Uint8Array): Uint8Array {
    const color = this._surroundColor?.();
    if (color === undefined) return rgba;

    const border = RECORDING_SURROUND;
    const width = this._width;
    const height = this._height;
    const outWidth = width + 2 * border;
    const outHeight = height + 2 * border;
    let frame = this._surroundFrame;
    if (!frame || frame.length !== outWidth * outHeight * 4) {
      frame = this._surroundFrame = new Uint8Array(outWidth * outHeight * 4);
    }
    // --- ABGR words, so the bytes in memory order are R, G, B, A
    new Uint32Array(frame.buffer, frame.byteOffset, outWidth * outHeight).fill(color >>> 0);
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
      const from = y * rowBytes;
      frame.set(rgba.subarray(from, from + rowBytes), ((y + border) * outWidth + border) * 4);
    }
    return frame;
  }

  /**
   * Submits a batch of audio samples to the recording.
   * The samples are expected as an AudioSample[] (stereo float pairs).
   * They are converted to interleaved f32le before being sent over IPC.
   *
   * Every sample is sent, whatever the video rate. Half fps halves the *frames* and the frame rate
   * together, so the video keeps its duration; the audio is a continuous signal at its own sample
   * rate and must keep all of it. This used to drop the audio of every skipped video frame, which
   * left a half-fps recording with half its sound, squeezed together: 2 s of video carried 1 s of
   * audio (issue #1374). On the Cambridge Z88, whose audio arrives per 5 ms frame and its video
   * per eight of them, it dropped whole 40 ms stretches.
   */
  async submitAudioSamples(samples: { left: number; right: number }[]): Promise<void> {
    if (this._state !== "recording") return;
    if (!samples || samples.length === 0) {
      return;
    }
    // Convert AudioSample[] → interleaved Float32Array [L0, R0, L1, R1, …]
    const interleaved = new Float32Array(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      interleaved[i * 2] = samples[i].left;
      interleaved[i * 2 + 1] = samples[i].right;
    }
    await this.mainApi.appendRecordingAudio(interleaved);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _startRecording(): Promise<void> {
    const effectiveFps =
      this._fps === "half" ? Math.max(1, Math.round(this._nativeFps / 2)) : this._nativeFps;

    this._captureCount = 0;
    try {
      const surround = this._surroundColor ? 2 * RECORDING_SURROUND : 0;
      const filePath = await this.mainApi.startScreenRecording(
        this._width + surround,
        this._height + surround,
        effectiveFps,
        this._xRatio,
        this._yRatio,
        this._sampleRate,
        this._getCrf(),
        this._format
      );
      this._state = "recording";
      this.dispatch(setScreenRecordingStateAction("recording", filePath, this._fps));
    } catch (err) {
      console.error(`[RecordingManager] IPC startScreenRecording FAILED:`, err);
      // Roll back to idle so the user can try again
      this._state = "idle";
      this.dispatch(setScreenRecordingStateAction("idle"));
    }
  }

  /** Maps the quality preference to a CRF value for FFmpeg. */
  private _getCrf(): number {
    switch (this._quality) {
      case "lossless":
        return 0;
      case "high":
        return 10;
      case "good":
      default:
        return 18;
    }
  }

  private async _stopRecording(): Promise<void> {
    const prevState = this._state;
    this._state = "idle";
    this.dispatch(setScreenRecordingStateAction("idle"));
    if (prevState === "recording" || prevState === "paused") {
      try {
        await this.mainApi.stopScreenRecording();
      } catch (err) {
        console.error(`[RecordingManager] IPC stopScreenRecording FAILED:`, err);
      }
    }
  }
}
