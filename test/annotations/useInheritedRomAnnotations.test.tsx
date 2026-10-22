import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import { resetRomAnnotationCachesForTests } from "@renderer/appIde/annotations/romAnnotationLoader";
import { useInheritedRomAnnotations } from "@renderer/appIde/annotations/useInheritedRomAnnotations";

/*
 * A ROM page document (the ROM annotation editor's page, `StaticMemoryDump`) lists the sidecar it
 * edits with the entries it inherits laid under its own, as the live Disassembly view does: the
 * 128K's ROM 1 page shows the 48K ROM's names, not only its own 99.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const ROM1 = new Uint8Array(readFileSync(join(ROMS, "sp128-1.rom")));
const own = parseAnnotations(readFileSync(join(ROMS, "sp128-1.rom.dis"), "utf8")).annotations!;
const mainApi = {
  readTextFile: async (path: string) => readFileSync(join(ROMS, path.replace(/^roms\//, "")), "utf8"),
  readBinaryFile: async (path: string) => new Uint8Array(readFileSync(join(ROMS, path.replace(/^roms\//, "")))),
  resolveKliveHomePath: async (relative: string) => `/nowhere/${relative}`,
  canWriteBeside: async () => false
} as any;
const projectService = { readFileContent: async () => { throw new Error("File does not exist"); } } as any;

describe("useInheritedRomAnnotations", () => {
  it("lists an inheriting ROM sidecar with the inherited entries under its own", async () => {
    resetRomAnnotationCachesForTests();
    const { result } = renderHook(() => useInheritedRomAnnotations(own, "rom", 0, ROM1, mainApi, projectService));
    await waitFor(() => expect(result.current!.banks["0"].localLabels!.length).toBeGreaterThan(1000));
    const names = new Map(result.current!.banks["0"].localLabels!.map((l) => [l.value, l.name]));
    expect(names.get(0x3b49)).toBe("ROM0_JUMP");
    expect(names.get(0x3d00)).toBe("CHARACTER_SET");
  });

  it("leaves anything else as it is", () => {
    const sp48 = parseAnnotations(readFileSync(join(ROMS, "sp48.rom.dis"), "utf8")).annotations!;
    const { result } = renderHook(() => useInheritedRomAnnotations(sp48, "rom", 0, ROM1, mainApi, projectService));
    expect(result.current).toBe(sp48);
  });
});
