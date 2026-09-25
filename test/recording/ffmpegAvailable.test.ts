import { describe, expect, it } from "vitest";

import { toUnpackedAsarPath } from "@main/recording/ffmpegAvailable";

/*
 * In a packaged app `@ffmpeg-installer/ffmpeg` reports its binary inside `app.asar`, which `spawn`
 * cannot execute; `asarUnpack` puts the real file under `app.asar.unpacked` (issue #1374).
 */
describe("toUnpackedAsarPath", () => {
  it("points a packaged macOS path at the unpacked copy", () => {
    expect(
      toUnpackedAsarPath(
        "/Applications/Klive IDE.app/Contents/Resources/app.asar/node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg"
      )
    ).toBe(
      "/Applications/Klive IDE.app/Contents/Resources/app.asar.unpacked/node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg"
    );
  });

  it("points a packaged Windows path at the unpacked copy", () => {
    expect(toUnpackedAsarPath("C:\\Klive\\resources\\app.asar\\node_modules\\@ffmpeg-installer\\win32-x64\\ffmpeg.exe")).toBe(
      "C:\\Klive\\resources\\app.asar.unpacked\\node_modules\\@ffmpeg-installer\\win32-x64\\ffmpeg.exe"
    );
  });

  it("leaves a development path and an already unpacked path alone", () => {
    const dev = "/Users/me/kliveide/node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg";
    expect(toUnpackedAsarPath(dev)).toBe(dev);
    const unpacked = "/K.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg";
    expect(toUnpackedAsarPath(unpacked)).toBe(unpacked);
  });
});
