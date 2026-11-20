import { describe, expect, it, vi } from "vitest";

import type { PaletteDeviceInfo } from "@common/messaging/EmuApi";
import {
  isEntryWritten,
  readNextPalette,
  writtenEntryCount
} from "@renderer/features/next-palette/nextPaletteRead";

/* Reading the Next's palettes only when they changed (NEXT_PALETTE_DEBUGGING_PLAN §5). */

const info = (over: Partial<PaletteDeviceInfo> = {}) => ({ ulaFirst: [], ...over }) as PaletteDeviceInfo;

describe("readNextPalette", () => {
  it("reads when there is no previous read", async () => {
    const fresh = info({ version: 1 });
    const api = { getPaletteVersion: vi.fn(), getPalettedDeviceInfo: vi.fn(async () => fresh) };
    expect(await readNextPalette(api)).toBe(fresh);
    expect(api.getPaletteVersion).not.toHaveBeenCalled();
  });

  it("returns the previous read itself while the version is unchanged", async () => {
    const previous = info({ version: 5 });
    const api = { getPaletteVersion: vi.fn(async () => 5), getPalettedDeviceInfo: vi.fn() };
    expect(await readNextPalette(api, previous)).toBe(previous);
    expect(api.getPalettedDeviceInfo).not.toHaveBeenCalled();
  });

  it("reads when the version moved, or the previous read has none, or the version query fails", async () => {
    const fresh = info({ version: 6 });
    const read = () => vi.fn(async () => fresh);

    let api = { getPaletteVersion: vi.fn(async () => 6), getPalettedDeviceInfo: read() };
    expect(await readNextPalette(api, info({ version: 5 }))).toBe(fresh);

    api = { getPaletteVersion: vi.fn(async () => 6), getPalettedDeviceInfo: read() };
    expect(await readNextPalette(api, info())).toBe(fresh);
    expect(api.getPaletteVersion).not.toHaveBeenCalled();

    api = { getPaletteVersion: vi.fn(async () => Promise.reject(new Error("x"))), getPalettedDeviceInfo: read() };
    expect(await readNextPalette(api, info({ version: 6 }))).toBe(fresh);
  });

  it("lets a failed full read propagate", async () => {
    const api = {
      getPaletteVersion: vi.fn(),
      getPalettedDeviceInfo: vi.fn(async () => Promise.reject(new Error("no machine")))
    };
    await expect(readNextPalette(api)).rejects.toThrow("no machine");
  });
});

describe("written marks", () => {
  const written = new Array(256).fill(0);
  written[2 * 32] = 0b1000_0001; // --- slot 2: entries 0 and 7
  written[2 * 32 + 31] = 0x80; // --- slot 2: entry 255
  written[7 * 32 + 1] = 0x01; // --- slot 7: entry 8

  it("counts a slot's written entries", () => {
    expect(writtenEntryCount(info({ written }), 2)).toBe(3);
    expect(writtenEntryCount(info({ written }), 7)).toBe(1);
    expect(writtenEntryCount(info({ written }), 0)).toBe(0);
    expect(writtenEntryCount(info(), 2)).toBe(0);
  });

  it("tells whether an entry was written", () => {
    expect(isEntryWritten(info({ written }), 2, 0)).toBe(true);
    expect(isEntryWritten(info({ written }), 2, 7)).toBe(true);
    expect(isEntryWritten(info({ written }), 2, 255)).toBe(true);
    expect(isEntryWritten(info({ written }), 2, 1)).toBe(false);
    expect(isEntryWritten(info({ written }), 7, 8)).toBe(true);
    expect(isEntryWritten(info({ written }), 6, 8)).toBe(false);
  });
});
