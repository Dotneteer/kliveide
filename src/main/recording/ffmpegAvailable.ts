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
    const binary = installer?.path ? toUnpackedAsarPath(installer.path) : "";
    _available = !!binary && existsSync(binary);
    _path = binary;
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

/**
 * The path of a file `asarUnpack` copied out of the app archive.
 *
 * In a packaged app `@ffmpeg-installer/ffmpeg` computes its binary's path from its own location,
 * which is inside `app.asar`. Electron's `fs` answers for that path, so the binary looked present, but
 * `spawn` cannot execute a file inside an archive. Every recording in a packaged build therefore
 * created its folder and nothing else (issue #1374). `electron-builder.json5` unpacks the package to
 * `app.asar.unpacked`, as the package's own README asks. In a development run there is no archive
 * and the path is returned unchanged.
 */
export function toUnpackedAsarPath(filePath: string): string {
  return filePath.replace(/([\\/])app\.asar([\\/])/, "$1app.asar.unpacked$2");
}
