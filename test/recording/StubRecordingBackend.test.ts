import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs before importing the module under test
vi.mock("fs", () => {
  const mockFs = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn()
  };
  return { default: mockFs, ...mockFs };
});

import * as fs from "fs";
import { StubRecordingBackend } from "@main/recording/StubRecordingBackend";

const OUTPUT = "/tmp/KliveExports/recording_20260228_140500.txt";
const W = 352;
const H = 296;
const FPS = 50;
const FAKE_RGBA = new Uint8Array(W * H * 4);

describe("StubRecordingBackend", () => {
  let backend: StubRecordingBackend;

  beforeEach(() => {
    vi.clearAllMocks();
    backend = new StubRecordingBackend();
  });

  it("finish() writes a text file to the given output path", async () => {
    backend.start(OUTPUT, W, H, FPS);
    await backend.finish();
    expect(fs.writeFileSync).toHaveBeenCalledWith(OUTPUT, expect.any(String), "utf8");
  });

  it("report contains start timestamp, stop timestamp, and resolution", async () => {
    backend.start(OUTPUT, W, H, FPS);
    await backend.finish();
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toMatch(/Recording started:/);
    expect(written).toMatch(/Recording stopped:/);
    expect(written).toMatch(/352 x 296/);
    expect(written).toMatch(/Target FPS:\s+50/);
  });

  it("appendFrame increments the frame counter", async () => {
    backend.start(OUTPUT, W, H, FPS);
    backend.appendFrame(FAKE_RGBA);
    backend.appendFrame(FAKE_RGBA);
    backend.appendFrame(FAKE_RGBA);
    await backend.finish();
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toMatch(/Frames recorded:\s+3/);
  });

  it("holdFrame also increments the frame counter", async () => {
    backend.start(OUTPUT, W, H, FPS);
    backend.appendFrame(FAKE_RGBA);
    backend.holdFrame();
    backend.holdFrame();
    await backend.finish();
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toMatch(/Frames recorded:\s+3/);
  });

  it("mixed appendFrame and holdFrame sum correctly", async () => {
    backend.start(OUTPUT, W, H, FPS);
    for (let i = 0; i < 5; i++) backend.appendFrame(FAKE_RGBA);
    for (let i = 0; i < 3; i++) backend.holdFrame();
    await backend.finish();
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toMatch(/Frames recorded:\s+8/);
  });

  it("finish() returns the output path", async () => {
    backend.start(OUTPUT, W, H, FPS);
    const result = await backend.finish();
    expect(result).toBe(OUTPUT);
  });

  it("duration is non-negative", async () => {
    backend.start(OUTPUT, W, H, FPS);
    await backend.finish();
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    const match = written.match(/Duration \(s\):\s+([\d.]+)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeGreaterThanOrEqual(0);
  });
});
