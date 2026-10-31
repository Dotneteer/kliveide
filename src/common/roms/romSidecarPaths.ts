import { NEXT_ROM_SETS, nextRomAnnotationFile, type NextRomSetId } from "@common/zxnext/romSets";

/*
 * How a shipped ROM sidecar is named, and where its working copy lives.
 *
 * A shipped ROM (and its sidecar) is named by its path relative to `src/public/roms`: `sp48.rom`
 * for the ROMs kept flat in that folder, `zxnext/<setId>/enNextZX.rom` for the ZX Spectrum Next's
 * ROM sets (`src/common/zxnext/romSets.ts`), which share file names between sets. The shipped
 * index, `inherits`, the ROM annotations menu and `rom-ann-open` all use these paths.
 */

/** The folder of the working copies, in the Klive home folder. */
export const WORKING_ROM_FOLDER = "RomAnnotations";

/**
 * The ROM set whose working copies stay flat in `RomAnnotations/` (`RomAnnotations/enNextZX.rom.dis`):
 * they were made before the Next's ROMs moved into set folders, and people have real work in them.
 * Every other set's go to `RomAnnotations/zxnext/<setId>/<file>.dis`, as its sidecars are shipped.
 */
const FLAT_WORKING_COPY_SET: NextRomSetId = "nextzxos-2.08";

const flatSetPrefix = `${nextRomAnnotationFile(FLAT_WORKING_COPY_SET, "")}`;

/** A sidecar's file name, without its folder: what the user is shown (`enNextZX.rom.dis`). */
export function sidecarFileName(sidecar: string): string {
  return sidecar.split(/[\\/]/).pop() ?? sidecar;
}

/** The Next ROM files of the flat set, by their legacy bare sidecar name. */
const LEGACY_FLAT_SIDECARS: ReadonlyMap<string, string> = new Map(
  Object.keys(NEXT_ROM_SETS[FLAT_WORKING_COPY_SET]?.files ?? {}).map((file) => [
    `${file}.dis`,
    `${nextRomAnnotationFile(FLAT_WORKING_COPY_SET, file)}.dis`
  ])
);

/**
 * The shipped sidecar a name means. A bare Next name from before the set folders
 * (`enNextZX.rom.dis`, as older sidecars' `inherits` and working copies still say) is the
 * `nextzxos-2.08` set's; any other name is itself.
 */
export function canonicalShippedSidecar(sidecar: string): string {
  return LEGACY_FLAT_SIDECARS.get(sidecar) ?? sidecar;
}

/**
 * The working copy of a shipped sidecar, relative to the Klive home folder: the one place that
 * decides it. `zxnext/nextzxos-2.08/enNextZX.rom.dis` → `RomAnnotations/enNextZX.rom.dis` (see
 * `FLAT_WORKING_COPY_SET`); `zxnext/<other set>/enNextZX.rom.dis` →
 * `RomAnnotations/zxnext/<other set>/enNextZX.rom.dis`; `sp48.rom.dis` → `RomAnnotations/sp48.rom.dis`.
 */
export function workingCopyRelativePath(sidecar: string): string {
  const canonical = canonicalShippedSidecar(sidecar);
  const name = canonical.startsWith(flatSetPrefix) ? canonical.slice(flatSetPrefix.length) : canonical;
  return `${WORKING_ROM_FOLDER}/${name}`;
}

/**
 * Whether a path relative to `src/public/roms` has the shape of a shipped ROM's or sidecar's: a bare
 * file name, or `zxnext/<setId>/<file>` for a set the manifest has.
 */
export function isShippedSidecarShape(relative: string): boolean {
  const parts = relative.split("/");
  return parts.length === 1 || (parts.length === 3 && parts[0] === "zxnext" && parts[1] in NEXT_ROM_SETS);
}

/**
 * The shipped sidecar a working copy is of, by its path relative to `RomAnnotations/`
 * (`enNextZX.rom.dis` → `zxnext/nextzxos-2.08/enNextZX.rom.dis`): the inverse of
 * `workingCopyRelativePath`. `undefined` for a path no working copy has.
 */
export function shippedSidecarOfWorkingCopy(relative: string): string | undefined {
  const normalized = relative.replace(/\\/g, "/");
  return isShippedSidecarShape(normalized) ? canonicalShippedSidecar(normalized) : undefined;
}

/**
 * The shipped sidecar a sidecar file stands for when it is in the shipped folder or the working-copy
 * folder — `roms/zxnext/nextzxos-2.08/enNextZX.rom.dis`, `.../public/roms/sp48.rom.dis`,
 * `<home>/RomAnnotations/enNextZX.rom.dis` — and which of the two it is; `undefined` for a sidecar
 * anywhere else (beside a custom ROM). Only `roms/` relative to the public folder counts as shipped
 * (`roms/…`, or a `roms` folder in `public` or `resources`), not any folder that happens to be called
 * `roms`, which is where plenty of people keep their own ROM files.
 */
export function managedSidecarOf(path: string): { sidecar: string; location: "working" | "shipped" } | undefined {
  const parts = path.replace(/\\/g, "/").split("/");
  if (parts[0] === "roms") {
    const rest = parts.slice(1).join("/");
    return isShippedSidecarShape(rest) ? { sidecar: rest, location: "shipped" } : undefined;
  }
  // --- The innermost managed folder wins: `RomAnnotations/zxnext/<set>/x.dis` before a `roms` above it
  for (let i = parts.length - 2; i >= 0; i--) {
    const rest = parts.slice(i + 1).join("/");
    if (parts[i] === WORKING_ROM_FOLDER) {
      const shipped = shippedSidecarOfWorkingCopy(rest);
      if (shipped) return { sidecar: shipped, location: "working" };
    }
    if (parts[i] === "roms" && (parts[i - 1] === "public" || parts[i - 1] === "resources") && isShippedSidecarShape(rest)) {
      return { sidecar: rest, location: "shipped" };
    }
  }
  return undefined;
}
