import path from "path";
import fs from "fs";

export const KLIVE_EXPORTS_FOLDER = "KliveExports";
export const VIDEO_SUBFOLDER = "video";

/**
 * Resolves the output path for a new recording file and ensures the
 * directory exists.
 *
 * Output directory: {homeDir}/KliveExports/video/
 *
 * @param homeDir User home directory (e.g. `app.getPath("home")`).
 * @param ext     File extension without the leading dot ("txt" | "mp4").
 * @param now     Optional Date override — inject in tests for determinism.
 */
export function resolveRecordingPath(
  homeDir: string,
  ext: string,
  now?: Date
): string {
  const d = now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const dir = path.join(homeDir, KLIVE_EXPORTS_FOLDER, VIDEO_SUBFOLDER);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `recording_${timestamp}.${ext}`);
}
