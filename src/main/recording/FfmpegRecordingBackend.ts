import { spawn, ChildProcess } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { IRecordingBackend } from "./IRecordingBackend";

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
  // Raw machine resolution
  private _rawWidth = 0;
  // Output (aspect-corrected) resolution fed to FFmpeg
  private _outWidth = 0;
  private _outHeight = 0;
  // Integer scale factors derived from xRatio / yRatio
  private _scaleX = 1;
  private _scaleY = 1;

  /**
   * Compute integer scale factors so that the smaller ratio becomes 1.
   * e.g. xRatio=0.5, yRatio=1  →  scaleX=1, scaleY=2  (double vertical)
   *      xRatio=1,   yRatio=1  →  scaleX=1, scaleY=1  (unchanged)
   */
  start(outputPath: string, width: number, height: number, fps: number, xRatio = 1, yRatio = 1): void {
    this._outputPath = outputPath;
    this._lastFrame = null;
    this._rawWidth = width;

    const minRatio = Math.min(xRatio, yRatio);
    this._scaleX = Math.round(xRatio / minRatio);
    this._scaleY = Math.round(yRatio / minRatio);
    this._outWidth  = width  * this._scaleX;
    this._outHeight = height * this._scaleY;

    const args = [
      "-y",
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-s", `${this._outWidth}x${this._outHeight}`,
      "-r", String(fps),
      "-i", "pipe:0",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "18",
      "-vf", "format=yuv420p",
      outputPath,
    ];

    this._process = spawn(ffmpegInstaller.path, args, {
      stdio: ["pipe", "ignore", "ignore"],
    });

    this._exitPromise = new Promise<void>((resolve, reject) => {
      this._process!.once("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
      this._process!.once("error", reject);
    });
  }

  /**
   * Write one raw RGBA frame to FFmpeg's stdin, scaling as needed.
   */
  appendFrame(rgba: Uint8Array): void {
    if (!this._process?.stdin) return;
    const buf = this._stretchFrame(rgba);
    this._lastFrame = buf;
    this._process.stdin.write(buf);
  }

  /**
   * Re-send the last frame (holds the image while the machine is paused so
   * the encoded video timeline stays continuous).
   */
  holdFrame(): void {
    if (!this._process?.stdin || !this._lastFrame) return;
    this._process.stdin.write(this._lastFrame);
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
    if (!this._process) return this._outputPath;
    this._process.stdin?.end();
    await this._exitPromise;
    this._process = null;
    this._exitPromise = null;
    return this._outputPath;
  }
}
