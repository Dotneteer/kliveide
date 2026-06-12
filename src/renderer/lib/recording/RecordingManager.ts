import type { MainApi } from "../../../common/messaging/MainApi";
import type {
  RecordingFormat,
  RecordingFps,
  RecordingQuality,
  ScreenRecordingState
} from "../../../common/state/AppState";
import {
  setScreenRecordingFormatAction,
  setScreenRecordingQualityAction,
  setScreenRecordingStateAction
} from "../../../common/state/actions";
import type { Action } from "../../../common/state/Action";
import type { Sp48AudioSample } from "../../../emu/sp48/WasmZxSpectrum48Machine";

type Dispatch = (action: Action) => void;

export class RecordingManager {
  private stateValue: ScreenRecordingState = "idle";
  private fpsPreference: RecordingFps = "native";
  private qualityPreference: RecordingQuality = "good";
  private formatPreference: RecordingFormat = "mp4";
  private width = 0;
  private height = 0;
  private nativeFps = 0;
  private xRatio = 1;
  private yRatio = 1;
  private sampleRate = 44100;
  private captureCount = 0;
  private lastSubmittedFrame = false;

  constructor(
    private readonly mainApi: MainApi,
    private readonly dispatch: Dispatch
  ) {}

  get state(): ScreenRecordingState {
    return this.stateValue;
  }

  syncPreferences(
    fps: RecordingFps | undefined,
    quality: RecordingQuality | undefined,
    format: RecordingFormat | undefined
  ): void {
    this.fpsPreference = fps ?? this.fpsPreference;
    this.qualityPreference = quality ?? this.qualityPreference;
    this.formatPreference = format ?? this.formatPreference;
  }

  setFpsPreference(fps: RecordingFps): void {
    this.fpsPreference = fps;
    this.dispatch(setScreenRecordingStateAction(this.stateValue, undefined, fps));
  }

  setQualityPreference(quality: RecordingQuality): void {
    this.qualityPreference = quality;
    this.dispatch(setScreenRecordingQualityAction(quality));
  }

  setFormatPreference(format: RecordingFormat): void {
    this.formatPreference = format;
    this.dispatch(setScreenRecordingFormatAction(format));
  }

  arm(fps?: RecordingFps, startNow = false): void {
    if (fps !== undefined) {
      this.fpsPreference = fps;
    }
    if (this.stateValue !== "idle") {
      return;
    }

    this.stateValue = "armed";
    this.dispatch(setScreenRecordingStateAction("armed", undefined, this.fpsPreference));
    if (startNow && this.width > 0 && this.height > 0) {
      void this.startRecording();
    }
  }

  async disarm(): Promise<void> {
    if (this.stateValue === "idle") {
      return;
    }
    if (this.stateValue === "recording" || this.stateValue === "paused") {
      await this.stopRecording();
      return;
    }

    this.stateValue = "idle";
    this.dispatch(setScreenRecordingStateAction("idle"));
  }

  async onMachineRunning(
    width: number,
    height: number,
    nativeFps: number,
    xRatio = 1,
    yRatio = 1,
    sampleRate = 44100
  ): Promise<void> {
    this.width = width;
    this.height = height;
    this.nativeFps = nativeFps;
    this.xRatio = xRatio;
    this.yRatio = yRatio;
    this.sampleRate = sampleRate;

    if (this.stateValue === "armed") {
      await this.startRecording();
    } else if (this.stateValue === "paused") {
      this.stateValue = "recording";
      this.dispatch(setScreenRecordingStateAction("recording"));
    }
  }

  onMachinePaused(): void {
    if (this.stateValue !== "recording") {
      return;
    }
    this.stateValue = "paused";
    this.dispatch(setScreenRecordingStateAction("paused"));
  }

  pauseRecording(): void {
    this.onMachinePaused();
  }

  resumeRecording(): void {
    if (this.stateValue !== "paused") {
      return;
    }
    this.stateValue = "recording";
    this.dispatch(setScreenRecordingStateAction("recording"));
  }

  async onMachineStopped(): Promise<void> {
    if (this.stateValue === "armed") {
      this.stateValue = "idle";
      this.dispatch(setScreenRecordingStateAction("idle"));
      return;
    }
    if (this.stateValue === "recording" || this.stateValue === "paused") {
      await this.stopRecording();
    }
  }

  async submitFrame(rgba: Uint8Array): Promise<void> {
    this.lastSubmittedFrame = false;
    if (this.stateValue !== "recording") {
      return;
    }

    this.captureCount++;
    if (this.fpsPreference === "half" && this.captureCount % 2 !== 0) {
      return;
    }

    this.lastSubmittedFrame = true;
    await this.mainApi.appendRecordingFrame(rgba);
  }

  async submitAudioSamples(samples: Sp48AudioSample[], soundLevel = 1.0): Promise<void> {
    if (this.stateValue !== "recording" || !this.lastSubmittedFrame || samples.length === 0) {
      return;
    }

    const interleaved = new Float32Array(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      const speaker = normalizeSample(samples[i].left) * soundLevel;
      interleaved[i * 2] = speaker;
      interleaved[i * 2 + 1] = speaker;
    }

    await this.mainApi.appendRecordingAudio(interleaved);
  }

  private async startRecording(): Promise<void> {
    const effectiveFps =
      this.fpsPreference === "half" ? Math.max(1, Math.round(this.nativeFps / 2)) : this.nativeFps;

    this.captureCount = 0;
    this.lastSubmittedFrame = false;
    try {
      const filePath = await this.mainApi.startScreenRecording(
        this.width,
        this.height,
        effectiveFps,
        this.xRatio,
        this.yRatio,
        this.sampleRate,
        this.getCrf(),
        this.formatPreference
      );
      this.stateValue = "recording";
      this.dispatch(setScreenRecordingStateAction("recording", filePath, this.fpsPreference));
    } catch (err) {
      console.error("[RecordingManager] startScreenRecording failed:", err);
      this.stateValue = "idle";
      this.dispatch(setScreenRecordingStateAction("idle"));
    }
  }

  private async stopRecording(): Promise<void> {
    const previousState = this.stateValue;
    this.stateValue = "idle";
    this.dispatch(setScreenRecordingStateAction("idle"));
    if (previousState === "recording" || previousState === "paused") {
      try {
        await this.mainApi.stopScreenRecording();
      } catch (err) {
        console.error("[RecordingManager] stopScreenRecording failed:", err);
      }
    }
  }

  private getCrf(): number {
    switch (this.qualityPreference) {
      case "lossless":
        return 0;
      case "high":
        return 10;
      case "good":
      default:
        return 18;
    }
  }
}

function normalizeSample(value: number): number {
  const normalized = Math.abs(value) > 1 ? value / 32768 : value;
  if (!Number.isFinite(normalized)) {
    return 0;
  }
  if (normalized > 1) {
    return 1;
  }
  if (normalized < -1) {
    return -1;
  }
  return normalized;
}
