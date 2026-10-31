import * as manifestModule from "./nextRomSets.json";

// --- Vite and vitest give a JSON module a default export; the plain CommonJS transpile some scripts
// --- load TypeScript through (`scripts/benchmark-zxnext-wasm.cjs`) gives the object itself
const manifest: typeof manifestModule = (manifestModule as any).default ?? manifestModule;

/*
 * The ZX Spectrum Next's ROM sets (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D9).
 *
 * A ROM set is one NextZXOS release from the official distribution: its ROM files, the SD card base
 * image built from the same release, and the ROM facts Klive's code depends on (D6). The files are
 * committed in `src/public/roms/zxnext/<setId>/`; `nextRomSets.json` records where they came from
 * (`npm run next-roms:fetch`) and what their bytes must be (`npm run next-roms:check`,
 * `test/zxnext/romSets.test.ts`). A Next model names its set (`nextProfiles.ts`): the set belongs to
 * NextZXOS, the hardware to the core.
 *
 * Neutral: read by the emulator, the main process, the IDE and the tests.
 */

/** A ROM set's id, as the manifest names it */
export type NextRomSetId = Exclude<keyof typeof manifestModule, "default">;

/** One committed ROM file of a set */
export type NextRomFileInfo = {
  size: number;
  sha256: string;
  /** The CRC-32 of each 16K page (one CRC for a file of 16K or less) */
  pages: string[];
};

/**
 * The addresses Klive's code depends on in a set's ROMs (D6), each proved against the ROM bytes by
 * `test/zxnext-hw/rom/rom-facts.test.ts`.
 */
export type NextRomFacts = {
  /** ROM 0: the bounds of NextZXOS's key-wait loop (the code-injection flow waits for it to settle there) */
  keyWaitLoop: [from: number, to: number];
  /** ROM 0: the `HALT` of the key-wait loop, which the code-injection flow stops at first */
  mainWaitingLoop: number;
  /** ROM 3: the 48K tape routines the core's tape traps (`zxnext-tape.c`) */
  ldBytes: { loadBytes: number; loadBytesInvalidHeader: number; loadBytesResume: number; saveBytes: number };
};

export type NextRomSet = {
  id: NextRomSetId;
  /** The NextZXOS version the set carries */
  nextZxOs: string;
  source: { project: string; ref: string; commit: string; dir: string };
  files: Readonly<Record<string, NextRomFileInfo>>;
  /** The SD card image a new working copy is made from, relative to `src/public` */
  sdBaseImage: { file: string; sha256: string };
  facts: NextRomFacts;
};

/** The four ROM images the core needs, by their role */
export const NEXT_ROM_FILES = {
  nextRom: "enNextZX.rom",
  divMmcRom: "enNxtmmc.rom",
  multifaceRom: "enNextMf.rom",
  altRom: "enAltZX.rom"
} as const;

const hex = (value: string) => Number.parseInt(value, 16);

function toRomSet(id: NextRomSetId): NextRomSet {
  const raw = manifest[id] as any;
  const facts = raw.facts;
  return {
    id,
    nextZxOs: raw.nextZxOs,
    source: raw.source,
    files: raw.files,
    sdBaseImage: raw.sdBaseImage,
    facts: {
      keyWaitLoop: [hex(facts.keyWaitLoop[0]), hex(facts.keyWaitLoop[1])],
      mainWaitingLoop: hex(facts.mainWaitingLoop),
      ldBytes: {
        loadBytes: hex(facts.ldBytes.loadBytes),
        loadBytesInvalidHeader: hex(facts.ldBytes.loadBytesInvalidHeader),
        loadBytesResume: hex(facts.ldBytes.loadBytesResume),
        saveBytes: hex(facts.ldBytes.saveBytes)
      }
    }
  };
}

/** Every ROM set Klive ships, by id */
export const NEXT_ROM_SETS: Readonly<Record<NextRomSetId, NextRomSet>> = Object.fromEntries(
  (Object.keys(manifest).filter((key) => key !== "default") as NextRomSetId[]).map((id) => [id, toRomSet(id)])
) as Record<NextRomSetId, NextRomSet>;

/** The CRC-32 of each 16K page of a ROM file, as the manifest records them (one for 16K or less) */
export function nextRomPageCrcs(bytes: Uint8Array): string[] {
  const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
  };
  if (bytes.length <= 0x4000) return [crc32(bytes)];
  const pages: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x4000) pages.push(crc32(bytes.subarray(offset, offset + 0x4000)));
  return pages;
}

/** The folder of a set's files, relative to `src/public` (as the app's file provider reads it) */
export function nextRomFolder(setId: NextRomSetId): string {
  return `roms/zxnext/${setId}`;
}

/**
 * A ROM file of a set, relative to `src/public`: the one place that knows where the Next's ROMs are
 * @param setId The ROM set
 * @param file The file name (`enNextZX.rom`)
 */
export function nextRomPath(setId: NextRomSetId, file: string): string {
  return `${nextRomFolder(setId)}/${file}`;
}

/**
 * A ROM file of a set, relative to `src/public/roms` (the ROM annotations' file names, which name a
 * shipped ROM by its path under that folder)
 */
export function nextRomAnnotationFile(setId: NextRomSetId, file: string): string {
  return `zxnext/${setId}/${file}`;
}
