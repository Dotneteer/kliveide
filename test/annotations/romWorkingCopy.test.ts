import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  baseFileOf,
  createWorkingCopy,
  freshRomSidecar,
  mergeLegacyOverlay,
  migrateLegacyOverlays,
  shippedChangedSince,
  shippedCrcOf
} from "@renderer/appIde/annotations/romWorkingCopy";
import { matchRomPages } from "@renderer/appIde/annotations/romSidecarMatch";
import { checkRomSidecar } from "@renderer/appIde/annotations/romSidecarCheck";
import { resetRomAnnotationCachesForTests } from "@renderer/appIde/annotations/romAnnotationLoader";
import type { RomPartitionInfo } from "@renderer/appIde/annotations/romAnnotationLoader";
import { romPageIdentity } from "@common/roms/romIdentity";

/*
 * Making a ROM page's working copy, and finding the ROM a sidecar describes
 * (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` R8, T5, §4.2-§4.3).
 */

const ROMS = join(__dirname, "../../src/public/roms");
const SHIPPED_TEXT = readFileSync(join(ROMS, "sp48.rom.dis"), "utf8");
const SP48 = new Uint8Array(readFileSync(join(ROMS, "sp48.rom")));
const WORKING = "/home/me/Klive/RomAnnotations/sp48.rom.dis";

function world(files: Record<string, string> = {}) {
  const disk: Record<string, string> = { ...files };
  return {
    disk,
    files: {
      readTextFile: vi.fn(async (path: string) => readFileSync(join(ROMS, path.replace(/^roms\//, "")), "utf8")),
      readBinaryFile: vi.fn(async (path: string) => {
        if (path.startsWith("roms/")) return new Uint8Array(readFileSync(join(ROMS, path.slice(5))));
        throw new Error("no such file");
      }),
      renameFileEntry: vi.fn(async (from: string, to: string) => {
        disk[to] = disk[from];
        delete disk[from];
      }),
      resolveKliveHomePath: vi.fn(async (relative: string) => `/home/me/Klive/${relative}`)
    },
    project: {
      readFileContent: vi.fn(async (path: string) => {
        if (disk[path] === undefined) throw new Error("File does not exist");
        return disk[path];
      }),
      saveFileContent: vi.fn(async (path: string, contents: string) => {
        disk[path] = contents;
      })
    }
  };
}

const SHIPPED_TARGET = {
  workingPath: WORKING,
  workingPage: 0,
  shippedSidecar: "sp48.rom.dis",
  crc32: "ddee531f",
  size: 0x4000,
  romName: "sp48.rom"
};

describe("createWorkingCopy", () => {
  it("copies the shipped sidecar exactly, and records what it started from", async () => {
    const w = world();
    expect(await createWorkingCopy(w.files as any, w.project as any, SHIPPED_TARGET)).toEqual({
      created: true,
      path: WORKING,
      from: "shipped"
    });
    expect(w.disk[WORKING]).toBe(SHIPPED_TEXT);
    expect(w.disk[baseFileOf(WORKING)]).toBe(`${shippedCrcOf(SHIPPED_TEXT)}\n`);
  });

  it("never overwrites a working copy", async () => {
    const w = world({ [WORKING]: "my work" });
    const result = await createWorkingCopy(w.files as any, w.project as any, SHIPPED_TARGET);
    expect(result).toMatchObject({ created: false, reason: expect.stringContaining("already exists") });
    expect(w.disk[WORKING]).toBe("my work");
  });

  it("starts a ROM Klive ships no sidecar for with a fresh, shippable one", async () => {
    const w = world();
    const bytes = new Uint8Array(readFileSync(join(ROMS, "sp128-0.rom")));
    const target = {
      workingPath: "/home/me/Klive/RomAnnotations/sp128-0.rom.dis",
      workingPage: 0,
      ...romPageIdentity(bytes),
      romName: "sp128-0.rom"
    };
    expect(await createWorkingCopy(w.files as any, w.project as any, target)).toMatchObject({ from: "fresh" });
    const text = w.disk[target.workingPath];
    expect(JSON.parse(text)).toMatchObject({ machine: "rom", pages: { "0": { crc32: target.crc32 } } });
    expect((await checkRomSidecar(text, () => bytes)).problems).toEqual([]);
  });
});

describe("shippedChangedSince (T5)", () => {
  it("says whether the shipped sidecar moved on since the copy was made", async () => {
    const w = world();
    await createWorkingCopy(w.files as any, w.project as any, SHIPPED_TARGET);
    expect(await shippedChangedSince(w.files as any, w.project as any, WORKING, "sp48.rom.dis")).toBe(false);
    w.disk[baseFileOf(WORKING)] = "00000000\n";
    expect(await shippedChangedSince(w.files as any, w.project as any, WORKING, "sp48.rom.dis")).toBe(true);
    delete w.disk[baseFileOf(WORKING)];
    expect(await shippedChangedSince(w.files as any, w.project as any, WORKING, "sp48.rom.dis")).toBeUndefined();
  });
});

describe("migrating the additive overlays of earlier builds (§4.2)", () => {
  const overlay = {
    schemaVersion: 3,
    machine: "rom",
    banks: {
      "0": {
        offsetIndex: 0,
        regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
        localLabels: [{ name: "MY_RESTART", value: 0x0008 }, { name: "MINE", value: 0x0001 }],
        lineAnnotations: { "1": { comment: "mine" } }
      }
    }
  };

  it("lays the overlay over the shipped sidecar, its entries winning, recorded as observed", async () => {
    const merged = JSON.parse(mergeLegacyOverlay(SHIPPED_TEXT, overlay, 0));
    const labels = merged.banks["0"].localLabels;
    expect(labels.filter((label: { value: number }) => label.value === 0x0008)).toEqual([{ name: "MY_RESTART", value: 0x0008 }]);
    expect(labels).toContainEqual({ name: "MINE", value: 1 });
    expect(merged.banks["0"].lineAnnotations["1"]).toEqual({ comment: "mine" });
    expect(merged.provenance["0:1:label"]).toBe("observed");
    expect((await checkRomSidecar(mergeLegacyOverlay(SHIPPED_TEXT, overlay, 0), () => SP48)).problems).toEqual([]);
  });

  it("turns an old overlay into a working copy once, keeping the old file as .bak", async () => {
    const legacy = "/home/me/Klive/RomAnnotations/ddee531f.rom.dis";
    const w = world({ [legacy]: JSON.stringify(overlay) });
    const info: RomPartitionInfo = {
      partition: -1,
      source: { crc32: "ddee531f", size: 0x4000, path: "roms/sp48.rom", page: 0 },
      workingPath: WORKING,
      workingPage: 0,
      hasWorkingCopy: false,
      shippedSidecar: "sp48.rom.dis",
      layers: [],
      bindings: []
    };
    expect(await migrateLegacyOverlays(w.files as any, w.project as any, [info])).toEqual([WORKING]);
    expect(w.disk[legacy]).toBeUndefined();
    expect(w.disk[`${legacy}.bak`]).toBe(JSON.stringify(overlay));
    expect(JSON.parse(w.disk[WORKING]).banks["0"].localLabels).toContainEqual({ name: "MINE", value: 1 });
    // --- With the working copy in place, nothing more happens
    expect(await migrateLegacyOverlays(w.files as any, w.project as any, [{ ...info, hasWorkingCopy: true }])).toEqual([]);
  });
});

describe("matchRomPages (§4.3)", () => {
  it("finds a working copy's ROM: the shipped ROM it is named after", async () => {
    resetRomAnnotationCachesForTests();
    const w = world();
    const [match] = await matchRomPages({ files: w.files as any }, WORKING, { "0": { crc32: "ddee531f", name: "48K" } });
    expect(match).toMatchObject({ page: 0, crc32: "ddee531f", foundAt: "the shipped sp48.rom", kind: "sp48-basic" });
    expect(match.bytes?.length).toBe(0x4000);
  });

  it("finds a page by CRC among the shipped ROMs when the name does not match", async () => {
    resetRomAnnotationCachesForTests();
    const w = world();
    const [match] = await matchRomPages({ files: w.files as any }, "/home/me/Klive/RomAnnotations/renamed.rom.dis", {
      "0": { crc32: "ddee531f" }
    });
    expect(match.foundAt).toBe("the shipped sp48.rom, page 0");
  });

  it("finds a page in the running machine's ROMs", async () => {
    resetRomAnnotationCachesForTests();
    const w = world();
    const custom = new Uint8Array(0x4000).fill(0x76);
    const emuApi = { getRomSources: vi.fn(async () => ({ [-1]: { ...romPageIdentity(custom), page: 0, bytes: custom } })) };
    const [match] = await matchRomPages({ files: w.files as any, emuApi }, "/home/me/Klive/RomAnnotations/x.rom.dis", {
      "0": { crc32: romPageIdentity(custom).crc32 }
    });
    expect(match.foundAt).toBe("the running machine's ROM page -1");
  });

  it("says where it looked when nothing matches", async () => {
    resetRomAnnotationCachesForTests();
    const w = world();
    const [match] = await matchRomPages({ files: w.files as any }, "/roms/custom.rom.dis", { "0": { crc32: "00000000" } });
    expect(match.bytes).toBeUndefined();
    expect(match.searched).toEqual(["/roms/custom.rom", "the shipped custom.rom", "the other shipped ROMs"]);
  });
});

describe("freshRomSidecar", () => {
  it("covers an 8K ROM with one code region of its own size", () => {
    const raw = JSON.parse(
      freshRomSidecar({ workingPath: "x", workingPage: 0, crc32: "12345678", size: 0x2000, romName: "zx81.rom" })
    );
    expect(raw.banks["0"].regions).toEqual([{ start: 0, end: 0x1fff, type: "disassemble" }]);
  });
});
