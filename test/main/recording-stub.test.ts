import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { StubRecordingBackend } from "../../src/main/recording/StubRecordingBackend";
import { resolveRecordingPath } from "../../src/main/recording/outputPath";

describe("recording stub backend", () => {
  it("resolves output paths under KliveExports/video", () => {
    const home = path.join(os.tmpdir(), `klive-recording-${Date.now()}`);
    const output = resolveRecordingPath(home, "mp4", new Date(Date.UTC(2026, 5, 12, 1, 2, 3)));

    expect(output).toBe(path.join(home, "KliveExports", "video", "recording_20260612_010203.mp4"));
    expect(fs.existsSync(path.dirname(output))).toBe(true);
  });

  it("writes a text report with frame and audio counters", async () => {
    const home = path.join(os.tmpdir(), `klive-recording-${Date.now()}`);
    const output = resolveRecordingPath(home, "webm", new Date(Date.UTC(2026, 5, 12, 1, 2, 3)));
    const backend = new StubRecordingBackend();

    backend.start(output, 352, 296, 50, 1, 1, 48000, 18, "webm");
    backend.appendFrame(new Uint8Array(352 * 296 * 4));
    backend.appendFrame(new Uint8Array(352 * 296 * 4));
    backend.appendAudioSamples(new Float32Array(128));

    const finished = await backend.finish();
    const report = fs.readFileSync(finished, "utf8");

    expect(finished).toBe(output);
    expect(report).toContain("Frames recorded:      2");
    expect(report).toContain("Audio batches:        1");
    expect(report).toContain("Audio sample values:  128");
    expect(report).toContain("Resolution:           352 x 296");
    expect(report).toContain("Target FPS:           50");
    expect(report).toContain("Format:               webm");
  });
});
