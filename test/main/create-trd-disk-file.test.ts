import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// --- The real one lives in the main process (Electron); paths here are absolute already
vi.mock("../../src/main/projects", () => ({ resolveHomeFilePath: (p: string) => p }));

import { createDiskFile } from "@common/utils/create-disk-file";
import { readTrdCatalog, readTrdDiskInfo } from "@emu/machines/disk/trd/trdImage";

/*
 * The Create Disk dialog's TR-DOS types make blank, formatted `.trd` files for the Pentagon's Beta 128
 * (`.plans/BETA128_TRDOS_PLAN.md` Phase 3); the CPC types still make `.dsk` files.
 */

let folder: string | undefined;
afterEach(() => {
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});

describe("createDiskFile", () => {
  it.each([
    ["trd80ds", 655360, 0x16, 2544],
    ["trd40ds", 327680, 0x17, 1264],
    ["trd80ss", 327680, 0x18, 1264],
    ["trd40ss", 163840, 0x19, 624]
  ])("%s makes a blank TR-DOS disk", (type, size, diskType, free) => {
    folder = mkdtempSync(join(tmpdir(), "klive-trd-"));
    const path = createDiskFile(folder, "games", type);
    expect(path.endsWith("games.trd")).toBe(true);
    const bytes = new Uint8Array(readFileSync(path));
    expect(bytes.length).toBe(size);
    expect(readTrdDiskInfo(bytes)).toMatchObject({ isTrDos: true, diskType, freeSectors: free, fileCount: 0, label: "games" });
    expect(readTrdCatalog(bytes)).toEqual([]);
  });

  it("still makes a CPC .dsk for the +3's types", () => {
    folder = mkdtempSync(join(tmpdir(), "klive-dsk-"));
    const path = createDiskFile(folder, "plus3", "ss");
    expect(path.endsWith("plus3.dsk")).toBe(true);
    expect(String.fromCharCode(...readFileSync(path).subarray(0, 8))).toBe("MV - CPC");
  });
});
