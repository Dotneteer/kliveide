import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NEXT_ROM_FILES, nextRomPath, type NextRomSetId } from "@common/zxnext/romSets";
import { nextProfileOf } from "@emu/machines/zxNext/nextProfiles";

import { REPO_ROOT } from "./machines";

/*
 * The ZX Spectrum Next's ROM files for a test, by ROM set (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md`
 * D9.5): the one place the tests find them. Without a set, the implicit model's (`ks2-30201`).
 */

/** The absolute path of a ROM file of a set */
export function nextRomFile(file: string, setId: NextRomSetId = nextProfileOf().romSet): string {
  return join(REPO_ROOT, "src/public", nextRomPath(setId, file));
}

/** The bytes of a ROM file of a set */
export function readNextRom(file: string, setId?: NextRomSetId): Uint8Array {
  return new Uint8Array(readFileSync(nextRomFile(file, setId)));
}

/** The four images the core needs, as `uploadWasmV2RomImages` takes them */
export function readNextRomImages(setId?: NextRomSetId) {
  return {
    nextRom: readNextRom(NEXT_ROM_FILES.nextRom, setId),
    divMmcRom: readNextRom(NEXT_ROM_FILES.divMmcRom, setId),
    multifaceRom: readNextRom(NEXT_ROM_FILES.multifaceRom, setId),
    altRom: readNextRom(NEXT_ROM_FILES.altRom, setId)
  };
}
