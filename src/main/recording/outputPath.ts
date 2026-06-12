import fs from "node:fs";
import path from "node:path";

export const KLIVE_EXPORTS_FOLDER = "KliveExports";
export const VIDEO_SUBFOLDER = "video";

export function resolveRecordingPath(homeDir: string, ext: string, now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `_${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const dir = path.join(homeDir, KLIVE_EXPORTS_FOLDER, VIDEO_SUBFOLDER);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `recording_${timestamp}.${ext}`);
}
