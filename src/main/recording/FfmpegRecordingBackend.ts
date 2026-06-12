import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import type { RecordingFormat } from "../../common/state/AppState";
import { getFFmpegPath } from "./ffmpegAvailable";
import type { IRecordingBackend } from "./IRecordingBackend";

export class FfmpegRecordingBackend implements IRecordingBackend {
  private process: ChildProcessWithoutNullStreams | null = null;
  private exitPromise: Promise<void> | null = null;
  private outputPath = "";
  private lastFrame: Buffer | null = null;
  private lastAudioChunk: Buffer | null = null;
  private rawWidth = 0;
  private outWidth = 0;
  private outHeight = 0;
  private scaleX = 1;
  private scaleY = 1;
  private dead = false;

  start(
    outputPath: string,
    width: number,
    height: number,
    fps: number,
    xRatio = 1,
    yRatio = 1,
    sampleRate = 44100,
    crf = 18,
    format: RecordingFormat = "mp4"
  ): void {
    this.dead = false;
    this.rawWidth = width;
    this.lastFrame = null;
    this.lastAudioChunk = null;

    const dirName = path.dirname(outputPath);
    const baseName = path.basename(outputPath, path.extname(outputPath));
    const ext = format === "webm" ? ".webm" : format === "mkv" ? ".mkv" : ".mp4";
    this.outputPath = path.join(dirName, baseName + ext);

    const minRatio = Math.min(xRatio || 1, yRatio || 1);
    this.scaleX = Math.max(1, Math.round((xRatio || 1) / minRatio));
    this.scaleY = Math.max(1, Math.round((yRatio || 1) / minRatio));
    this.outWidth = width * this.scaleX;
    this.outHeight = height * this.scaleY;

    this.process = spawn(getFFmpegPath(), this.buildArgs(fps, sampleRate, crf, format), {
      stdio: ["pipe", "ignore", "pipe", "pipe"]
    }) as ChildProcessWithoutNullStreams;

    const stderr: string[] = [];
    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (chunk: string) => stderr.push(chunk));
    this.process.stdin.on("error", suppressPipeError);
    this.audioPipe()?.on("error", suppressPipeError);

    this.exitPromise = new Promise<void>((resolve, reject) => {
      this.process?.once("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }

        this.dead = true;
        const message = `FFmpeg exited with code ${code ?? signal}`;
        if (stderr.length > 0) {
          console.error("[FFmpegRecordingBackend]", stderr.join(""));
        }
        reject(new Error(message));
      });
      this.process?.once("error", reject);
    });
    this.exitPromise.catch(() => undefined);
  }

  appendFrame(rgba: Uint8Array): void {
    if (this.dead || !this.process?.stdin) {
      return;
    }
    const frame = this.stretchFrame(rgba);
    this.lastFrame = frame;
    this.process.stdin.write(frame);
  }

  holdFrame(): void {
    if (this.dead || !this.process?.stdin || !this.lastFrame) {
      return;
    }
    this.process.stdin.write(this.lastFrame);
    if (this.lastAudioChunk) {
      this.audioPipe()?.write(this.lastAudioChunk);
    }
  }

  appendAudioSamples(samples: Float32Array): void {
    if (this.dead) {
      return;
    }

    let clean = samples;
    for (let i = 0; i < samples.length; i++) {
      if (!Number.isFinite(samples[i])) {
        clean = clean === samples ? new Float32Array(samples) : clean;
        clean[i] = 0;
      }
    }

    const audio = Buffer.from(clean.buffer, clean.byteOffset, clean.byteLength);
    this.lastAudioChunk = audio;
    this.audioPipe()?.write(audio);
  }

  async finish(): Promise<string> {
    if (!this.process || this.dead) {
      this.resetProcess();
      return this.outputPath;
    }

    this.process.stdin.end();
    this.audioPipe()?.end();
    try {
      await this.exitPromise;
    } finally {
      this.resetProcess();
    }
    return this.outputPath;
  }

  private buildArgs(
    fps: number,
    sampleRate: number,
    crf: number,
    format: RecordingFormat
  ): string[] {
    const common = [
      "-y",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${this.outWidth}x${this.outHeight}`,
      "-r",
      String(fps),
      "-i",
      "pipe:0",
      "-f",
      "f32le",
      "-ar",
      String(sampleRate),
      "-ac",
      "2",
      "-i",
      "pipe:3"
    ];

    switch (format) {
      case "webm":
        return [
          ...common,
          "-c:v",
          "libvpx-vp9",
          "-deadline",
          crf === 0 ? "good" : "realtime",
          "-cpu-used",
          crf === 0 ? "2" : "5",
          "-crf",
          String(crf),
          "-b:v",
          "0",
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
          "-c:a",
          "libopus",
          "-b:a",
          "192k",
          this.outputPath
        ];
      case "mkv":
        return [
          ...common,
          "-c:v",
          "libx265",
          "-preset",
          crf === 0 ? "ultrafast" : "fast",
          "-crf",
          String(crf),
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          this.outputPath
        ];
      case "mp4":
      default:
        return [
          ...common,
          "-c:v",
          "libx264",
          "-preset",
          crf === 0 ? "ultrafast" : "fast",
          "-crf",
          String(crf),
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          this.outputPath
        ];
    }
  }

  private stretchFrame(rgba: Uint8Array): Buffer {
    if (this.scaleX === 1 && this.scaleY === 1) {
      return Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    }

    const output = Buffer.allocUnsafe(this.outWidth * this.outHeight * 4);
    for (let y = 0; y < this.outHeight; y++) {
      const sourceY = Math.floor(y / this.scaleY);
      const sourceRow = sourceY * this.rawWidth * 4;
      const targetRow = y * this.outWidth * 4;
      for (let x = 0; x < this.outWidth; x++) {
        const sourceX = Math.floor(x / this.scaleX);
        const source = sourceRow + sourceX * 4;
        const target = targetRow + x * 4;
        output[target] = rgba[source];
        output[target + 1] = rgba[source + 1];
        output[target + 2] = rgba[source + 2];
        output[target + 3] = rgba[source + 3];
      }
    }
    return output;
  }

  private audioPipe(): NodeJS.WritableStream | undefined {
    return this.process?.stdio[3] as NodeJS.WritableStream | undefined;
  }

  private resetProcess(): void {
    this.process = null;
    this.exitPromise = null;
    this.dead = false;
  }
}

function suppressPipeError(err: NodeJS.ErrnoException): void {
  if (err.code !== "EPIPE") {
    console.error("[FfmpegRecordingBackend] pipe error:", err.message);
  }
}
