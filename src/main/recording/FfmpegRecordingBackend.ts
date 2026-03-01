import { spawn, ChildProcess } from "child_process";
import path from "path";
import { getFFmpegPath } from "./ffmpegAvailable";
import type { IRecordingBackend } from "./IRecordingBackend";
import type { RecordingFormat } from "@common/state/AppState";

/**
 * Phase-B FFmpeg backend.
 *
 * Spawns an FFmpeg child process that reads raw RGBA frames from stdin and
 * encodes them as an H.264 / MP4 file at the specified output path.
 *
 * FFmpeg command used:
 *   ffmpeg -y -f rawvideo -pix_fmt rgba -s {W}x{H} -r {fps}
 *          -i pipe:0 -c:v libx264 -preset fast -crf 18
 *          -vf format=yuv420p {outputPath}
 */
export class FfmpegRecordingBackend implements IRecordingBackend {
  private _process: ChildProcess | null = null;
  private _exitPromise: Promise<void> | null = null;
  private _outputPath = "";
  private _lastFrame: Buffer | null = null;
  private _lastAudioChunk: Buffer | null = null;
  // Raw machine resolution
  private _rawWidth = 0;
  // Output (aspect-corrected) resolution fed to FFmpeg
  private _outWidth = 0;
  private _outHeight = 0;
  // Integer scale factors derived from xRatio / yRatio
  private _scaleX = 1;
  private _scaleY = 1;
  // Set to true when FFmpeg exits early; suppresses further writes
  private _dead = false;

  /**
   * Compute integer scale factors so that the smaller ratio becomes 1.
   * e.g. xRatio=0.5, yRatio=1  →  scaleX=1, scaleY=2  (double vertical)
   *      xRatio=1,   yRatio=1  →  scaleX=1, scaleY=1  (unchanged)
   */
  start(outputPath: string, width: number, height: number, fps: number, xRatio = 1, yRatio = 1, sampleRate = 44100, crf = 18, format: RecordingFormat = "mp4"): void {
    this._dead = false;
    // Replace file extension based on format
    const dirName = path.dirname(outputPath);
    const baseName = path.basename(outputPath, path.extname(outputPath));
    const ext = format === "webm" ? ".webm" : format === "mkv" ? ".mkv" : ".mp4";
    this._outputPath = path.join(dirName, baseName + ext);

    this._lastFrame = null;
    this._lastAudioChunk = null;
    this._rawWidth = width;

    const minRatio = Math.min(xRatio, yRatio);
    this._scaleX = Math.round(xRatio / minRatio);
    this._scaleY = Math.round(yRatio / minRatio);
    this._outWidth  = width  * this._scaleX;
    this._outHeight = height * this._scaleY;

    // Build format-specific FFmpeg arguments
    const args = this._buildFFmpegArgs(fps, sampleRate, crf, format);

    this._process = spawn(getFFmpegPath(), args, {
      stdio: ["pipe", "ignore", "pipe", "pipe"],
    });

    // Suppress EPIPE errors on the video and audio pipes so a premature FFmpeg
    // exit does not crash the Electron main process.
    this._process.stdin?.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code !== "EPIPE") console.error("[FFmpegBackend] stdin error:", err.message);
    });
    const audioPipe = (this._process.stdio as any)[3];
    audioPipe?.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code !== "EPIPE") console.error("[FFmpegBackend] audio pipe error:", err.message);
    });
    // Consume stderr so FFmpeg errors are visible in the console and backpressure
    // does not stall the child process.
    const stderrLines: string[] = [];
    this._process.stderr?.setEncoding("utf8");
    this._process.stderr?.on("data", (chunk: string) => {
      stderrLines.push(chunk);
    });

    this._exitPromise = new Promise<void>((resolve, reject) => {
      this._process!.once("exit", (code, signal) => {
        if (code === 0) {
          resolve();
        } else {
          this._dead = true;
          this._process = null;
          const msg = `FFmpeg exited with code ${code ?? signal}`;
          console.error(`[FFmpegBackend] ${msg}`);
          if (stderrLines.length) console.error("[FFmpegBackend] stderr:", stderrLines.join(""));
          reject(new Error(msg));
        }
      });
      this._process!.once("error", (err) => {
        this._dead = true;
        this._process = null;
        reject(err);
      });
    });
    // Prevent unhandled rejection from propagating — errors are reported via
    // finish() rejection or the console above.
    this._exitPromise.catch(() => {});
  }

  /**
   * Build FFmpeg command arguments based on the selected format.
   */
  private _buildFFmpegArgs(fps: number, sampleRate: number, crf: number, format: RecordingFormat): string[] {
    const commonArgs = [
      "-y",
      // Video input: raw RGBA frames from stdin (pipe:0)
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-s", `${this._outWidth}x${this._outHeight}`,
      "-r", String(fps),
      "-i", "pipe:0",
      // Audio input: raw f32le stereo from fd 3 (pipe:3)
      "-f", "f32le",
      "-ar", String(sampleRate),
      "-ac", "2",
      "-i", "pipe:3",
    ];

    let codecArgs: string[] = [];

    switch (format) {
      case "webm":
        // VP9 + Opus (best compression, slower)
        // VP9 uses -deadline (realtime=fast, good=balanced, best=slow) and -cpu-used (0–5)
        codecArgs = [
          "-c:v", "libvpx-vp9",
          "-deadline", crf === 0 ? "good" : "realtime",
          "-cpu-used", crf === 0 ? "2" : "5",
          "-crf", String(crf),
          "-b:v", "0", // VBR mode for VP9
          "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
          "-c:a", "libopus",
          "-b:a", "192k",
          this._outputPath,
        ];
        break;

      case "mkv":
        // H.265/HEVC + AAC (better compression than H.264)
        codecArgs = [
          "-c:v", "libx265",
          "-preset", crf === 0 ? "ultrafast" : "fast",
          "-crf", String(crf),
          "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
          "-c:a", "aac",
          "-b:a", "192k",
          this._outputPath,
        ];
        break;

      case "mp4":
      default:
        // H.264 + AAC (universal, fast)
        codecArgs = [
          "-c:v", "libx264",
          "-preset", crf === 0 ? "ultrafast" : "fast",
          "-crf", String(crf),
          "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
          "-c:a", "aac",
          "-b:a", "192k",
          this._outputPath,
        ];
        break;
    }

    return [...commonArgs, ...codecArgs];
  }

  /**
   * Write one raw RGBA frame to FFmpeg's stdin, scaling as needed.
   */
  appendFrame(rgba: Uint8Array): void {
    if (this._dead || !this._process?.stdin) return;
    const buf = this._stretchFrame(rgba);
    this._lastFrame = buf;
    this._process.stdin.write(buf);
  }

  /**
   * Re-send the last video frame and last audio chunk (holds both timelines
   * continuous while the machine is paused).
   */
  holdFrame(): void {
    if (this._dead || !this._process?.stdin || !this._lastFrame) return;
    this._process.stdin.write(this._lastFrame);
    if (this._lastAudioChunk) {
      const audioPipe = (this._process.stdio as any)[3];
      audioPipe?.write(this._lastAudioChunk);
    }
  }

  /**
   * Write one batch of interleaved stereo f32le audio samples to FFmpeg's
   * audio input pipe (fd 3).
   */
  appendAudioSamples(samples: Float32Array): void {
    if (this._dead) return;
    const audioPipe = (this._process?.stdio as any)?.[3];
    if (!audioPipe) return;
    // Sanitize: replace NaN / ±Inf with 0 to prevent AAC encoder failure.
    let clean = samples;
    for (let i = 0; i < samples.length; i++) {
      if (!isFinite(samples[i])) {
        if (clean === samples) clean = new Float32Array(samples); // copy-on-write
        clean[i] = 0;
      }
    }
    const buf = Buffer.from(clean.buffer, clean.byteOffset, clean.byteLength);
    this._lastAudioChunk = buf;
    audioPipe.write(buf);
  }

  /**
   * Nearest-neighbour upscale from raw machine resolution to output resolution.
   * When scaleX===1 && scaleY===1 the input buffer is wrapped directly (no copy).
   */
  private _stretchFrame(rgba: Uint8Array): Buffer {
    if (this._scaleX === 1 && this._scaleY === 1) {
      return Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    }
    const out = Buffer.allocUnsafe(this._outWidth * this._outHeight * 4);
    for (let oy = 0; oy < this._outHeight; oy++) {
      const sy = Math.floor(oy / this._scaleY);
      const srcRow = sy * this._rawWidth * 4;
      const dstRow = oy * this._outWidth * 4;
      for (let ox = 0; ox < this._outWidth; ox++) {
        const sx = Math.floor(ox / this._scaleX);
        const s = srcRow + sx * 4;
        const d = dstRow + ox * 4;
        out[d]     = rgba[s];
        out[d + 1] = rgba[s + 1];
        out[d + 2] = rgba[s + 2];
        out[d + 3] = rgba[s + 3];
      }
    }
    return out;
  }

  /**
   * Close FFmpeg's stdin and await clean process exit.
   * @returns The absolute path of the finished MP4 file.
   */
  async finish(): Promise<string> {
    if (!this._process || this._dead) {
      this._process = null;
      this._exitPromise = null;
      this._dead = false;
      return this._outputPath;
    }
    // Close both the video pipe (stdin/fd 0) and the audio pipe (fd 3) so
    // FFmpeg sees EOF on both inputs and can flush the output file.
    this._process.stdin?.end();
    const audioPipe = (this._process.stdio as any)[3];
    audioPipe?.end();
    try {
      await this._exitPromise;
    } catch {
      // FFmpeg exited non-zero; error already logged in the exit handler
    }
    this._process = null;
    this._exitPromise = null;
    this._dead = false;
    return this._outputPath;
  }
}
