import path from "path";
import fs from "fs";

export const KLIVE_EXPORTS_FOLDER = "KliveExports";

/**
 * Resolves the output path for a new recording file and ensures the
 * directory exists.
 *
 * @param homeDir  User home directory  (e.g. `app.getPath("home")`).
 * @param kliveDir Klive home folder name (e.g. `KLIVE_HOME_FOLDER`).
 * @param ext      File extension without the leading dot ("txt" | "mp4").
 * @param now      Optional Date override — inject in tests for determinism.
 */
export function resolveRecordingPath(
  homeDir: string,
  kliveDir: string,
  ext: string,
  now?: Date
): string {
  const d = now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const dir = path.join(homeDir, kliveDir, KLIVE_EXPORTS_FOLDER);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `recording_${timestamp}.${ext}`);
}
