import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  legacyOverlayRelativePath,
  loadRomPartitions,
  resetRomAnnotationCachesForTests,
  workingCopyOf,
  workingCopyRelativePath
} from "@renderer/appIde/annotations/romAnnotationLoader";
import { bindRomPage } from "@renderer/appIde/annotations/romBinding";
import { clearAnnotationSessions } from "@renderer/appIde/annotations/annotationSession";
import { romPageIdentity, type RomSource } from "@common/roms/romIdentity";
import { createAddressSymbols } from "@renderer/appIde/annotations/symbolResolver";
import { sp48BankSpace } from "@common/annotations/bankSpace";

/*
 * Finding a paged ROM page's annotations (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` §4.2, amending
 * §5.2-§5.3 of the reverse-engineering plan): by its bytes; a working copy *replacing* the shipped
 * sidecar when there is one; byte binding where the bytes are another ROM's.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const romFile = (name: string) => new Uint8Array(readFileSync(join(ROMS, name)));
const SP48 = romFile("sp48.rom");
const SHIPPED = JSON.parse(readFileSync(join(ROMS, "sp48.rom.dis"), "utf8"));

function deps(sources: Record<number, RomSource>, options: { writable?: boolean; user?: Record<string, string> } = {}) {
  return {
    emuApi: { getRomSources: vi.fn(async () => sources) },
    files: {
      readTextFile: vi.fn(async (path: string) => readFileSync(join(ROMS, path.replace(/^roms\//, "")), "utf8")),
      readBinaryFile: vi.fn(async (path: string) => romFile(path.replace(/^roms\//, ""))),
      resolveKliveHomePath: vi.fn(async (relative: string) => `/home/me/Klive/${relative}`),
      canWriteBeside: vi.fn(async () => options.writable ?? true)
    },
    projectService: {
      readFileContent: vi.fn(async (path: string) => {
        const contents = options.user?.[path];
        if (contents === undefined) throw new Error("File does not exist");
        return contents;
      })
    },
    machineId: "sp48"
  };
}

const source = (bytes: Uint8Array, path?: string): RomSource => ({
  ...romPageIdentity(bytes),
  page: 0,
  bytes,
  ...(path ? { path } : {})
});

beforeEach(() => {
  resetRomAnnotationCachesForTests();
  clearAnnotationSessions();
});

describe("where a ROM page's working copy is (R1)", () => {
  it("a shipped ROM's is in the Klive home folder, named exactly like the shipped sidecar", async () => {
    const d = deps({});
    expect(await workingCopyOf(d.files as any, source(SP48, "roms/sp48.rom"))).toEqual({
      path: "/home/me/Klive/RomAnnotations/sp48.rom.dis",
      page: 0,
      shippedSidecar: "sp48.rom.dis"
    });
    expect(workingCopyRelativePath("sp48.rom.dis")).toBe("RomAnnotations/sp48.rom.dis");
    expect(legacyOverlayRelativePath("ddee531f")).toBe("RomAnnotations/ddee531f.rom.dis");
  });

  it("a file byte-identical to a shipped ROM shares the shipped ROM's working copy", async () => {
    expect((await workingCopyOf(deps({}).files as any, source(SP48, "/elsewhere/copy.rom"))).path).toBe(
      "/home/me/Klive/RomAnnotations/sp48.rom.dis"
    );
  });

  it("a custom ROM's goes beside it, or into the Klive home folder by its name when not writable", async () => {
    const custom = new Uint8Array(0x4000).fill(0x76);
    const userRom = source(custom, "/roms/my48.rom");
    expect(await workingCopyOf(deps({}, { writable: true }).files as any, userRom)).toEqual({
      path: "/roms/my48.rom.dis",
      page: 0
    });
    expect(await workingCopyOf(deps({}, { writable: false }).files as any, userRom)).toEqual({
      path: "/home/me/Klive/RomAnnotations/my48.rom.dis",
      page: 0
    });
  });
});

describe("loadRomPartitions", () => {
  it("finds the shipped sidecar by CRC, even for a user file byte-identical to sp48.rom", async () => {
    const [info] = await loadRomPartitions(deps({ [-1]: source(SP48, "/elsewhere/copy.rom") }) as any);
    expect(info.layers.map((layer) => [layer.kind, layer.path, !!layer.bound])).toEqual([
      ["shipped", "roms/sp48.rom.dis", false]
    ]);
    // --- The bytes were for binding only
    expect(info.source.bytes).toBeUndefined();
  });

  it("shows the shipped sidecar read-only when there is no working copy", async () => {
    const [info] = await loadRomPartitions(deps({ [-1]: source(SP48, "roms/sp48.rom") }) as any);
    expect(info.hasWorkingCopy).toBe(false);
    expect(info.workingPath).toBe("/home/me/Klive/RomAnnotations/sp48.rom.dis");
    expect(info.shippedSidecar).toBe("sp48.rom.dis");
  });

  it("lets a working copy replace the shipped sidecar, not stack on it (R2)", async () => {
    const workingPath = "/home/me/Klive/RomAnnotations/sp48.rom.dis";
    // --- The shipped file, with one label renamed and another removed
    const working = JSON.parse(JSON.stringify(SHIPPED));
    const labels = working.banks["0"].localLabels as { name: string; value: number }[];
    labels.find((label) => label.value === 0x0008)!.name = "MY_ERROR";
    const removed = labels.find((label) => label.value !== 0x0008)!;
    working.banks["0"].localLabels = labels.filter((label) => label !== removed);
    const [info] = await loadRomPartitions(
      deps({ [-1]: source(SP48, "roms/sp48.rom") }, { user: { [workingPath]: JSON.stringify(working) } }) as any
    );
    expect(info.hasWorkingCopy).toBe(true);
    expect(info.layers.map((layer) => [layer.kind, layer.path])).toEqual([["working", workingPath]]);
    const symbols = createAddressSymbols({ bankSpace: sp48BankSpace, romLayersOf: () => info.layers });
    // --- No shipped name shows through: not the old name, not the removed one
    expect(symbols.allAt(0x0008, []).map((hit) => hit.name)).toEqual(["MY_ERROR"]);
    expect(symbols.allAt(removed.value, [])).toEqual([]);
  });

  it("ignores a working copy that names another ROM's CRC", async () => {
    const workingPath = "/home/me/Klive/RomAnnotations/sp48.rom.dis";
    const other = { ...SHIPPED, pages: { "0": { crc32: "00000000", name: "not this one" } } };
    const [info] = await loadRomPartitions(
      deps({ [-1]: source(SP48, "roms/sp48.rom") }, { user: { [workingPath]: JSON.stringify(other) } }) as any
    );
    expect(info.hasWorkingCopy).toBe(false);
    expect(info.layers.map((layer) => layer.kind)).toEqual(["shipped"]);
  });

  it("binds an unknown 48K BASIC page against the *working* sp48 when there is one (R3)", async () => {
    const workingPath = "/home/me/Klive/RomAnnotations/sp48.rom.dis";
    const working = JSON.parse(JSON.stringify(SHIPPED));
    working.banks["0"].localLabels.push({ name: "WORKING_ONLY", value: 0x0000 });
    const patched = SP48.slice();
    patched[0x2ab6 + 1] ^= 0xff;
    const [info] = await loadRomPartitions(
      deps({ [-1]: source(patched, "/roms/custom.rom") }, { user: { [workingPath]: JSON.stringify(working) } }) as any
    );
    expect(info.layers).toHaveLength(1);
    expect(info.layers[0].kind).toBe("working");
    expect(info.layers[0].bound?.has(0x0000)).toBe(true);
  });

  it("binds an unknown 48K BASIC page against sp48.rom.dis (Q7), reporting how many labels bound", async () => {
    const patched = SP48.slice();
    patched[0x2ab6 + 1] ^= 0xff; // inside STK_STORE
    const [info] = await loadRomPartitions(deps({ [-1]: source(patched, "/roms/custom.rom") }) as any);
    expect(info.layers).toHaveLength(1);
    expect(info.layers[0].bound).toBeDefined();
    expect(info.bindings[0].binding.labelsTotal).toBe(SHIPPED.banks["0"].localLabels.length);
    expect(info.bindings[0].binding.labelsBound).toBe(SHIPPED.banks["0"].localLabels.length - 1);
  });

  it("gives an unknown page that is not a 48K BASIC page nothing shipped", async () => {
    const other = new Uint8Array(0x4000).fill(0x76);
    const [info] = await loadRomPartitions({ ...deps({ [-1]: source(other) }), machineId: "sp128" } as any);
    expect(info.layers).toEqual([]);
  });
});

describe("byte binding (§5.3)", () => {
  const bank = SHIPPED.banks["0"];

  it("drops exactly the labels of a patched routine", () => {
    const patched = SP48.slice();
    patched[0x04c2 + 2] ^= 0x01; // SA_BYTES
    const binding = bindRomPage(bank, SP48, patched);
    const names = bank.localLabels
      .filter((label: { value: number }) => !binding.bound.has(label.value))
      .map((label: { name: string }) => label.name);
    expect(names).toEqual(["SA_BYTES"]);
    // --- Its comments go with it; another label's stay
    expect(binding.bound.has(0x04c2)).toBe(false);
    expect(binding.bound.has(0x0556)).toBe(true);
  });

  it("keeps a data region only when all its bytes match", () => {
    const patched = SP48.slice();
    patched[0x3d10] ^= 0xff;
    expect(bindRomPage(bank, SP48, patched).boundRegions.has(0x3d00)).toBe(false);
    expect(bindRomPage(bank, SP48, SP48).boundRegions.has(0x3d00)).toBe(true);
  });

  it("keeps most of the 48K ROM's labels on the 128K's ROM 1", () => {
    const binding = bindRomPage(bank, SP48, romFile("sp128-1.rom"));
    // --- Measured once (2026-10-09) on the R0 sidecar, recorded so a change shows. A span runs to
    // --- the next label, so with this few labels a span is thousands of bytes and one changed byte
    // --- in it costs the label: the share rises as the sidecar is authored to level 1.
    expect(binding.labelsTotal).toBe(12);
    expect(binding.labelsBound).toBe(8);
  });
});
