import { spawnSync } from "node:child_process";
import fs from "node:fs";

let ffmpegAvailable: boolean | undefined;
let ffmpegPath = "";

function initialize(): void {
  if (ffmpegAvailable !== undefined) {
    return;
  }

  const candidate = findFFmpegPath();
  ffmpegAvailable = candidate !== "";
  ffmpegPath = candidate;
}

export function isFFmpegAvailable(): boolean {
  initialize();
  return ffmpegAvailable ?? false;
}

export function getFFmpegPath(): string {
  initialize();
  return ffmpegPath;
}

function findFFmpegPath(): string {
  const installerPath = findBundledInstallerPath();
  if (installerPath) {
    return installerPath;
  }

  for (const candidate of [
    "ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg"
  ]) {
    if (canRunFFmpeg(candidate)) {
      return candidate;
    }
  }

  return "";
}

function findBundledInstallerPath(): string {
  try {
    // Optional dependency used by the original Klive implementation. It may not
    // be installed in this workspace, so keep this dynamic and best-effort.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installer = require("@ffmpeg-installer/ffmpeg") as { path?: string };
    return installer.path && fs.existsSync(installer.path) ? installer.path : "";
  } catch {
    return "";
  }
}

function canRunFFmpeg(candidate: string): boolean {
  const result = spawnSync(candidate, ["-version"], {
    encoding: "utf8",
    stdio: "ignore"
  });
  return result.status === 0;
}
