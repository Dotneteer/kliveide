import fs from "node:fs";
import path from "node:path";
import type { IRecordingBackend } from "./IRecordingBackend";

/**
 * Text-report backend used until the real FFmpeg backend is migrated.
 */
export class StubRecordingBackend implements IRecordingBackend {
  private outputPath = "";
  private width = 0;
  private height = 0;
  private fps = 0;
  private sampleRate = 44100;
  private format = "mp4";
  private crf = 18;
  private frameCount = 0;
  private audioBatchCount = 0;
  private audioSampleCount = 0;
  private startedAt: Date | null = null;

  start(
    outputPath: string,
    width: number,
    height: number,
    fps: number,
    _xRatio = 1,
    _yRatio = 1,
    sampleRate = 44100,
    crf = 18,
    format = "mp4"
  ): void {
    this.outputPath = outputPath;
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.sampleRate = sampleRate;
    this.format = format;
    this.crf = crf;
    this.frameCount = 0;
    this.audioBatchCount = 0;
    this.audioSampleCount = 0;
    this.startedAt = new Date();
  }

  appendFrame(_rgba: Uint8Array): void {
    this.frameCount++;
  }

  holdFrame(): void {
    this.frameCount++;
  }

  appendAudioSamples(samples: Float32Array): void {
    this.audioBatchCount++;
    this.audioSampleCount += samples.length;
  }

  async finish(): Promise<string> {
    const stoppedAt = new Date();
    const durationMs = stoppedAt.getTime() - (this.startedAt?.getTime() ?? stoppedAt.getTime());
    const report =
      [
        `Recording started:    ${this.startedAt?.toISOString() ?? ""}`,
        `Recording stopped:    ${stoppedAt.toISOString()}`,
        `Duration (s):         ${(durationMs / 1000).toFixed(1)}`,
        `Frames recorded:      ${this.frameCount}`,
        `Audio batches:        ${this.audioBatchCount}`,
        `Audio sample values:  ${this.audioSampleCount}`,
        `Resolution:           ${this.width} x ${this.height}`,
        `Target FPS:           ${this.fps}`,
        `Audio sample rate:    ${this.sampleRate} Hz`,
        `Format:               ${this.format}`,
        `CRF:                  ${this.crf}`
      ].join("\n") + "\n";

    fs.mkdirSync(path.dirname(this.outputPath), { recursive: true });
    fs.writeFileSync(this.outputPath, report, "utf8");
    return this.outputPath;
  }
}
