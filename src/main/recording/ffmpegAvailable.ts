/**
 * Detects whether the FFmpeg binary is available on the current platform/arch.
 *
 * @ffmpeg-installer/ffmpeg throws "Unsupported platform/architecture" during
 * require() on platforms where no binary is bundled (e.g. win32-arm64).
 * We catch that here so the rest of the app can start normally and simply
 * hide the screen-recording UI.
 */
type FfmpegInstaller = { path: string };

let _available: boolean | undefined;
let _path: string = "";

function _init(): void {
  if (_available !== undefined) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installer = require("@ffmpeg-installer/ffmpeg") as FfmpegInstaller;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require("fs") as typeof import("fs");
    _available = !!installer?.path && existsSync(installer.path);
    _path = installer.path ?? "";
  } catch {
    _available = false;
    _path = "";
  }
}

/** Returns true if the FFmpeg binary is available on this platform/arch. */
export function isFFmpegAvailable(): boolean {
  _init();
  return _available!;
}

/** Returns the absolute path to the FFmpeg binary, or empty string if unavailable. */
export function getFFmpegPath(): string {
  _init();
  return _path;
}
