import type { MainApi } from "@common/messaging/MainApi";
import type { RecordingFps, RecordingQuality, ScreenRecordingState } from "@common/state/AppState";
import { setScreenRecordingQualityAction, setScreenRecordingStateAction } from "@common/state/actions";

type Dispatch = (action: any) => void;

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
  private _width = 0;
  private _height = 0;
  private _nativeFps = 0;
  private _xRatio = 1;
  private _yRatio = 1;
  private _sampleRate = 44100;
  private _captureCount = 0; // increments every submitFrame call; used for half-fps skipping

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
   * Arms the recorder. Recording begins when the machine next starts running.
   * Uses the stored fps preference when called without an argument.
   * No-op if not idle.
   */
  arm(fps?: RecordingFps, startNow = false): void {
    if (fps !== undefined) this._fps = fps;
    console.log(`[RecordingManager] arm(${this._fps}, startNow=${startNow}) called — current state: ${this._state}`);
    if (this._state !== "idle") return;
    this._state = "armed";
    this.dispatch(setScreenRecordingStateAction("armed", undefined, this._fps));
    console.log(`[RecordingManager] state → armed`);
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
    console.log(`[RecordingManager] disarm() called — current state: ${this._state}`);
    if (this._state === "idle") return;
    if (this._state === "recording" || this._state === "paused") {
      await this._stopRecording();
    } else {
      // armed but machine never ran
      this._state = "idle";
      this.dispatch(setScreenRecordingStateAction("idle"));
      console.log(`[RecordingManager] state → idle (disarmed without recording)`);
    }
  }

  // ---------------------------------------------------------------------------
  // Machine lifecycle hooks — called by EmulatorPanel
  // ---------------------------------------------------------------------------

  /**
   * Called whenever the machine transitions to the Running state (first start
   * or resume after pause).
   */
  async onMachineRunning(width: number, height: number, nativeFps: number, xRatio = 1, yRatio = 1, sampleRate = 44100): Promise<void> {
    console.log(`[RecordingManager] onMachineRunning(${width}x${height} @${nativeFps}fps ratio=${xRatio}:${yRatio} audio=${sampleRate}Hz) — state: ${this._state}`);
    this._width = width;
    this._height = height;
    this._nativeFps = nativeFps;
    this._xRatio = xRatio;
    this._yRatio = yRatio;
    this._sampleRate = sampleRate;

    if (this._state === "armed") {
      await this._startRecording();
    } else if (this._state === "paused") {
      this._state = "recording";
      this.dispatch(setScreenRecordingStateAction("recording"));
      console.log(`[RecordingManager] state → recording (resumed)`);
    }
  }

  /**
   * Called when the machine transitions to the Paused state.
   * Frame submission stops; the file stays open.
   */
  onMachinePaused(): void {
    console.log(`[RecordingManager] onMachinePaused() — state: ${this._state}`);
    if (this._state !== "recording") return;
    this._state = "paused";
    this.dispatch(setScreenRecordingStateAction("paused"));
    console.log(`[RecordingManager] state → paused`);
  }

  /**
   * Manually pauses an active recording (does not pause the machine).
   * No-op if not currently recording.
   */
  pauseRecording(): void {
    console.log(`[RecordingManager] pauseRecording() — state: ${this._state}`);
    if (this._state !== "recording") return;
    this._state = "paused";
    this.dispatch(setScreenRecordingStateAction("paused"));
    console.log(`[RecordingManager] state → paused (manual)`);
  }

  /**
   * Resumes a manually-paused recording (the machine keeps running).
   * No-op if not currently paused.
   */
  resumeRecording(): void {
    console.log(`[RecordingManager] resumeRecording() — state: ${this._state}`);
    if (this._state !== "paused") return;
    this._state = "recording";
    this.dispatch(setScreenRecordingStateAction("recording"));
    console.log(`[RecordingManager] state → recording (manual resume)`);
  }

  /**
   * Called when the machine transitions to the Stopped state.
   * Finalises and closes the recording file if active.
   */
  async onMachineStopped(): Promise<void> {
    console.log(`[RecordingManager] onMachineStopped() — state: ${this._state}`);
    if (this._state === "armed") {
      this._state = "idle";
      this.dispatch(setScreenRecordingStateAction("idle"));
      console.log(`[RecordingManager] state → idle (stopped while armed)`);
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
    await this.mainApi.appendRecordingFrame(rgba);
  }

  /**
   * Submits a batch of audio samples to the recording.
   * The samples are expected as an AudioSample[] (stereo float pairs).
   * They are converted to interleaved f32le before being sent over IPC.
   * Skipping is kept in sync with submitFrame: when half-fps is active and
   * the current capture count is odd (the video frame was skipped), the
   * audio is also dropped.
   */
  async submitAudioSamples(samples: { left: number; right: number }[]): Promise<void> {
    if (this._state !== "recording") return;
    // Mirror the half-fps skip: _captureCount was already incremented by
    // submitFrame for this logical frame. Odd counts are the skipped ones.
    if (this._fps === "half" && this._captureCount % 2 !== 0) return;
    if (!samples || samples.length === 0) return;
    // Convert AudioSample[] → interleaved Float32Array [L0, R0, L1, R1, …]
    const interleaved = new Float32Array(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      interleaved[i * 2]     = samples[i].left;
      interleaved[i * 2 + 1] = samples[i].right;
    }
    await this.mainApi.appendRecordingAudio(interleaved);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _startRecording(): Promise<void> {
    const effectiveFps =
      this._fps === "half"
        ? Math.max(1, Math.round(this._nativeFps / 2))
        : this._nativeFps;

    console.log(`[RecordingManager] _startRecording — ${this._width}x${this._height} @${effectiveFps}fps audio=${this._sampleRate}Hz (mode: ${this._fps}, quality: ${this._quality})`);
    this._captureCount = 0;
    try {
      const filePath = await this.mainApi.startScreenRecording(
        this._width,
        this._height,
        effectiveFps,
        this._xRatio,
        this._yRatio,
        this._sampleRate,
        this._getCrf()
      );
      console.log(`[RecordingManager] IPC startScreenRecording OK → ${filePath}`);
      this._state = "recording";
      this.dispatch(setScreenRecordingStateAction("recording", filePath, this._fps));
      console.log(`[RecordingManager] state → recording`);
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
      case "lossless": return 0;
      case "high":     return 10;
      case "good":
      default:         return 18;
    }
  }

  private async _stopRecording(): Promise<void> {
    console.log(`[RecordingManager] _stopRecording — state: ${this._state}`);
    const prevState = this._state;
    this._state = "idle";
    this.dispatch(setScreenRecordingStateAction("idle"));
    if (prevState === "recording" || prevState === "paused") {
      try {
        const filePath = await this.mainApi.stopScreenRecording();
        console.log(`[RecordingManager] IPC stopScreenRecording OK → ${filePath}`);
      } catch (err) {
        console.error(`[RecordingManager] IPC stopScreenRecording FAILED:`, err);
      }
    }
    console.log(`[RecordingManager] state → idle`);
  }
}
