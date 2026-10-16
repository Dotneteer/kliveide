import type { EmuApi } from "@common/messaging/EmuApi";
import type { MainApi } from "@common/messaging/MainApi";

import { romPageIdentity, type RomPageKind, knownRomPageKind } from "@common/roms/romIdentity";
import { readShippedIndex, SHIPPED_ROM_FOLDER, WORKING_ROM_FOLDER } from "./romAnnotationLoader";

/*
 * Matching a selected ROM sidecar to the ROM it describes (`.plans/ROM_ANNOTATION_EDITING_PLAN.md`
 * §4.3). A sidecar names each page by CRC (`pages`); the editor needs the bytes with that CRC, and
 * looks for them in this order:
 *
 * 1. the ROM file a custom ROM's `<path>.dis` sits beside;
 * 2. the shipped ROM the file is named after (`sp48.rom.dis` → `roms/sp48.rom`), its CRC checked;
 * 3. any shipped ROM page with that CRC, through the shipped index;
 * 4. the ROM partitions of the machine running now.
 *
 * A page that matches nowhere is reported with the places searched, so the editor can say why.
 */

export type RomPageMatch = {
  page: number;
  /** The CRC the sidecar names for the page. */
  crc32: string;
  /** The page's name in the sidecar. */
  name?: string;
  /** The bytes, when found. */
  bytes?: Uint8Array;
  /** Where they were found. */
  foundAt?: string;
  /** How the page's code is decoded (`romDecoder.ts`), when Klive knows the page. */
  kind?: RomPageKind;
  /** Every place looked in, for the message when nothing matched. */
  searched: string[];
};

export type RomMatchDeps = {
  files: Pick<MainApi, "readBinaryFile" | "readTextFile">;
  emuApi?: Pick<EmuApi, "getRomSources">;
};

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function pageOf(bytes: Uint8Array, page: number): Uint8Array | undefined {
  const start = page * 0x4000;
  if (start >= bytes.length) return undefined;
  return bytes.subarray(start, Math.min(bytes.length, start + 0x4000));
}

/**
 * Whether a sidecar path is in the working-copy folder or the shipped one, not beside a ROM.
 *
 * The shipped folder is `roms/` relative to the public folder, `src/public/roms` in a checkout or
 * `resources/roms` when packaged — not any folder that happens to be called `roms`, which is where
 * plenty of people keep their own ROM files.
 */
function isManagedLocation(path: string): boolean {
  if (path.startsWith(`${SHIPPED_ROM_FOLDER}/`)) return true;
  const parts = path.split(/[\\/]/);
  const folder = parts[parts.length - 2];
  const parent = parts[parts.length - 3];
  return (
    folder === WORKING_ROM_FOLDER ||
    (folder === SHIPPED_ROM_FOLDER && (parent === "public" || parent === "resources"))
  );
}

/**
 * Find the bytes of every page a sidecar names.
 *
 * @param sidecarPath The sidecar's full path
 * @param pages The sidecar's `pages`
 */
export async function matchRomPages(
  deps: RomMatchDeps,
  sidecarPath: string,
  pages: Record<string, { crc32?: string; name?: string }>
): Promise<RomPageMatch[]> {
  const files = new Map<string, Promise<Uint8Array | undefined>>();
  const read = (label: string, path: string, resolveIn?: string) => {
    let pending = files.get(label);
    if (!pending) {
      pending = deps.files.readBinaryFile(path, resolveIn).catch(() => undefined);
      files.set(label, pending);
    }
    return pending;
  };
  const romName = fileNameOf(sidecarPath).replace(/\.dis$/i, "");
  const index = await readShippedIndex(deps.files);
  let machine: Promise<Record<number, { bytes?: Uint8Array; path?: string }>> | undefined;

  const result: RomPageMatch[] = [];
  for (const [key, info] of Object.entries(pages ?? {})) {
    const page = Number(key);
    const crc32 = info?.crc32 ?? "";
    const match: RomPageMatch = { page, crc32, ...(info?.name ? { name: info.name } : {}), searched: [] };
    const accept = (bytes: Uint8Array | undefined, at: string): boolean => {
      if (!bytes || romPageIdentity(bytes).crc32 !== crc32) return false;
      match.bytes = bytes;
      match.foundAt = at;
      match.kind = knownRomPageKind(romPageIdentity(bytes));
      return true;
    };

    // --- 1. Beside a custom ROM
    if (!isManagedLocation(sidecarPath) && /\.dis$/i.test(sidecarPath)) {
      const romPath = sidecarPath.replace(/\.dis$/i, "");
      match.searched.push(romPath);
      const bytes = await read(romPath, romPath);
      if (accept(bytes && pageOf(bytes, page), romPath)) {
        result.push(match);
        continue;
      }
    }
    // --- 2. The shipped ROM it is named after
    const shippedPath = `${SHIPPED_ROM_FOLDER}/${romName}`;
    match.searched.push(`the shipped ${romName}`);
    const shipped = await read(shippedPath, shippedPath);
    if (accept(shipped && pageOf(shipped, page), `the shipped ${romName}`)) {
      result.push(match);
      continue;
    }
    // --- 3. Any shipped page with the CRC
    const entry = index[crc32];
    if (entry) {
      const otherName = entry.sidecar.replace(/\.dis$/i, "");
      const otherPath = `${SHIPPED_ROM_FOLDER}/${otherName}`;
      match.searched.push(`the shipped ${otherName}`);
      const other = await read(otherPath, otherPath);
      if (accept(other && pageOf(other, entry.page), `the shipped ${otherName}, page ${entry.page}`)) {
        result.push(match);
        continue;
      }
    } else {
      match.searched.push("the other shipped ROMs");
    }
    // --- 4. The machine running now
    if (deps.emuApi) {
      match.searched.push("the ROMs of the machine running now");
      machine ??= deps.emuApi.getRomSources(true).catch(() => ({}));
      const sources = await machine;
      for (const [partition, source] of Object.entries(sources ?? {})) {
        if (accept(source.bytes, `the running machine's ROM page ${partition}`)) break;
      }
    }
    result.push(match);
  }
  return result.sort((a, b) => a.page - b.page);
}
