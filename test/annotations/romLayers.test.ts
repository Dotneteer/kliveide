import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  loadRomPartitions,
  resetRomAnnotationCachesForTests,
  romOverlayRelativePath,
  userLayerPathOf
} from "@renderer/appIde/annotations/romAnnotationLoader";
import { bindRomPage } from "@renderer/appIde/annotations/romBinding";
import { clearAnnotationSessions } from "@renderer/appIde/annotations/annotationSession";
import { romPageIdentity, type RomSource } from "@common/roms/romIdentity";
import { createAddressSymbols } from "@renderer/appIde/annotations/symbolResolver";
import { sp48BankSpace } from "@common/annotations/bankSpace";

/*
 * Finding a paged ROM page's annotations (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.2,
 * §5.3): by its bytes, with the user's own layer over the shipped one, and byte binding where the
 * bytes are another ROM's.
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

describe("where the user's ROM annotations go (§5.2)", () => {
  it("a shipped ROM's go to the Klive home folder, named by CRC", async () => {
    const d = deps({});
    expect(await userLayerPathOf(d.files as any, source(SP48, "roms/sp48.rom"))).toEqual({
      path: "/home/me/Klive/RomAnnotations/ddee531f.rom.dis",
      page: 0
    });
    expect(romOverlayRelativePath("ddee531f")).toBe("RomAnnotations/ddee531f.rom.dis");
  });

  it("a user's ROM file's go beside it, or to the overlay when that folder is not writable", async () => {
    const userRom = source(SP48, "/roms/my48.rom");
    expect(await userLayerPathOf(deps({}, { writable: true }).files as any, userRom)).toEqual({
      path: "/roms/my48.rom.dis",
      page: 0
    });
    expect(await userLayerPathOf(deps({}, { writable: false }).files as any, userRom)).toEqual({
      path: "/home/me/Klive/RomAnnotations/ddee531f.rom.dis",
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

  it("puts the user's layer first, and its name wins at the same offset", async () => {
    const userPath = "/home/me/Klive/RomAnnotations/ddee531f.rom.dis";
    const user = JSON.stringify({
      schemaVersion: 3,
      machine: "rom",
      banks: { "0": { regions: [], localLabels: [{ name: "MY_CLS", value: 0x0008 }] } }
    });
    const [info] = await loadRomPartitions(
      deps({ [-1]: source(SP48, "roms/sp48.rom") }, { user: { [userPath]: user } }) as any
    );
    expect(info.layers.map((layer) => layer.kind)).toEqual(["user", "shipped"]);
    const symbols = createAddressSymbols({
      bankSpace: sp48BankSpace,
      romLayersOf: () => info.layers
    });
    expect(symbols.labelAt(0x0008, [])?.name).toBe("MY_CLS");
    expect(symbols.allAt(0x0008, []).map((hit) => hit.name)).toEqual(["MY_CLS", "ERROR_1"]);
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
