import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";

// --- Mock fs before importing the module under test
vi.mock("fs", () => {
  const mockFs = {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn()
  };
  return { default: mockFs, ...mockFs };
});

import * as fs from "fs";
import { resolveRecordingPath, KLIVE_EXPORTS_FOLDER } from "@main/recording/outputPath";

const HOME = "/home/testuser";
const KLIVE = "Klive";
const FIXED_DATE = new Date("2026-02-28T14:05:03.000Z");

describe("resolveRecordingPath", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("builds the correct path for a txt extension", () => {
    const result = resolveRecordingPath(HOME, KLIVE, "txt", FIXED_DATE);
    const expected = path.join(HOME, KLIVE, KLIVE_EXPORTS_FOLDER, "recording_20260228_140503.txt");
    expect(result).toBe(expected);
  });

  it("builds the correct path for an mp4 extension", () => {
    const result = resolveRecordingPath(HOME, KLIVE, "mp4", FIXED_DATE);
    expect(result).toMatch(/recording_20260228_140503\.mp4$/);
  });

  it("creates the exports directory when it does not exist", () => {
    resolveRecordingPath(HOME, KLIVE, "txt", FIXED_DATE);
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.join(HOME, KLIVE, KLIVE_EXPORTS_FOLDER),
      { recursive: true }
    );
  });

  it("skips mkdirSync when the directory already exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    resolveRecordingPath(HOME, KLIVE, "txt", FIXED_DATE);
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it("zero-pads single-digit month, day, hour, minute, second", () => {
    const d = new Date("2026-01-05T09:08:07.000Z");
    const result = resolveRecordingPath(HOME, KLIVE, "txt", d);
    expect(result).toMatch(/recording_20260105_090807\.txt$/);
  });
});
