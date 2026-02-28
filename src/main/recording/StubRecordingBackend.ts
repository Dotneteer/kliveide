import fs from "fs";
import path from "path";
import type { IRecordingBackend } from "./IRecordingBackend";

/**
 * Phase-A stub backend.
 *
 * Instead of encoding video, it writes a plain-text report to the output
 * path so the full UI + IPC flow can be exercised without FFmpeg.
 *
 * Report format:
 *   Recording started:  <ISO timestamp>
 *   Recording stopped:  <ISO timestamp>
 *   Duration (s):       <seconds>
 *   Frames recorded:    <count>
 *   Resolution:         <W> x <H>
 *   Target FPS:         <fps>
 */
export class StubRecordingBackend implements IRecordingBackend {
  private outputPath = "";
  private width = 0;
  private height = 0;
  private fps = 0;
  private sampleRate = 44100;
  private frameCount = 0;
  private startedAt: Date | null = null;

  start(outputPath: string, width: number, height: number, fps: number, _xRatio = 1, _yRatio = 1, sampleRate = 44100, _crf = 18): void {
    this.outputPath = outputPath;
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.sampleRate = sampleRate;
    this.frameCount = 0;
    this.startedAt = new Date();
  }

  appendFrame(_rgba: Uint8Array): void {
    this.frameCount++;
  }

  holdFrame(): void {
    // Counts as a frame to keep the timeline continuous during pause.
    this.frameCount++;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  appendAudioSamples(_samples: Float32Array): void {
    // No-op in the stub — audio samples are not recorded.
  }

  async finish(): Promise<string> {
    const stoppedAt = new Date();
    const durationMs = stoppedAt.getTime() - (this.startedAt?.getTime() ?? 0);
    const durationSec = (durationMs / 1000).toFixed(1);

    const report = [
      `Recording started:  ${this.startedAt?.toISOString() ?? ""}`,
      `Recording stopped:  ${stoppedAt.toISOString()}`,
      `Duration (s):       ${durationSec}`,
      `Frames recorded:    ${this.frameCount}`,
      `Resolution:         ${this.width} x ${this.height}`,
      `Target FPS:         ${this.fps}`,
      `Audio sample rate:  ${this.sampleRate} Hz`
    ].join("\n") + "\n";

    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.outputPath, report, "utf8");
    return this.outputPath;
  }
}
