import type { EmuApi } from "@common/messaging/EmuApi";
import type { MainApi } from "@common/messaging/MainApi";
import type { IProjectService } from "@renderer/abstractions/IProjectService";

import {
  isBasic48RomPage,
  isShippedRomPath,
  type RomSource
} from "@common/roms/romIdentity";
import { loadAnnotationSidecar } from "./annotationSidecar";
import { peekAnnotationSession } from "./annotationSession";
import { annotationMachineOf, parseAnnotations, type ProgramAnnotations } from "./programAnnotations";
import { bindRomPage, type RomBinding } from "./romBinding";
import type { RomLayer } from "./romLayer";

/*
 * Finding a paged ROM page's sidecars (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.2-§5.3).
 *
 * For each ROM partition the machine reports (`getRomSources`), up to two layers stack:
 *
 * 1. **the user layer** — for a shipped ROM file (a relative `roms/…` source), the overlay
 *    `<Klive home>/RomAnnotations/<crc32>.rom.dis`; for a user ROM file, `<path>.dis` beside it,
 *    falling back to the overlay when that folder is not writable. It is the layer the IDE edits,
 *    and it exists only once something is written into it.
 * 2. **the shipped layer** — found **by CRC in the shipped index**, not by file name, so a user file
 *    byte-identical to `sp48.rom` still gets it. A shipped sidecar's `inherits` add byte-bound layers
 *    after it. A page whose CRC is unknown, in a 48K BASIC position, gets `sp48.rom.dis` byte-bound
 *    (Q7).
 */

/** Where the shipped sidecars and their index are, relative to the public folder. */
export const SHIPPED_ROM_FOLDER = "roms";
export const SHIPPED_ROM_INDEX = "roms/rom-annotations.index.json";
/** The shipped sidecar every 48K BASIC page falls back to (Q7). */
export const SP48_SIDECAR = "sp48.rom.dis";

/** The shipped index: a page CRC to the sidecar and page that describe it. */
export type ShippedRomIndex = Record<string, { sidecar: string; page: number }>;

/** What the IDE knows about one ROM partition. */
export type RomPartitionInfo = {
  partition: number;
  source: RomSource;
  /** Where the user's own annotations of this page are (or will be) written. */
  userPath: string;
  /** The page within `userPath`'s banks. */
  userPage: number;
  /** The layers, user first. */
  layers: RomLayer[];
  /** For a byte-bound shipped layer: how many labels bound, for `ann-info`. */
  bindings: { sidecar: string; binding: RomBinding }[];
};

export type RomLoaderFiles = Pick<
  MainApi,
  "readTextFile" | "readBinaryFile" | "resolveKliveHomePath" | "canWriteBeside"
>;

export type RomLoaderDeps = {
  emuApi: Pick<EmuApi, "getRomSources">;
  files: RomLoaderFiles;
  projectService: Pick<IProjectService, "readFileContent">;
  machineId: string | undefined;
};

/** The overlay of a ROM page in the Klive home folder, by its CRC-32. */
export function romOverlayRelativePath(crc32: string): string {
  return `RomAnnotations/${crc32}.rom.dis`;
}

// ------------------------------------------------------------------------------------------------
// Shipped files, read once

let shippedIndex: Promise<ShippedRomIndex> | undefined;
const shippedSidecars = new Map<string, Promise<ProgramAnnotations | undefined>>();
const shippedRomBytes = new Map<string, Promise<Uint8Array | undefined>>();
const bindingCache = new Map<string, RomBinding>();

function readShippedIndex(files: RomLoaderFiles): Promise<ShippedRomIndex> {
  shippedIndex ??= files
    .readTextFile(SHIPPED_ROM_INDEX)
    .then((text) => JSON.parse(text) as ShippedRomIndex)
    .catch(() => ({}));
  return shippedIndex;
}

function readShippedSidecar(
  files: RomLoaderFiles,
  sidecar: string
): Promise<ProgramAnnotations | undefined> {
  let pending = shippedSidecars.get(sidecar);
  if (!pending) {
    pending = files
      .readTextFile(`${SHIPPED_ROM_FOLDER}/${sidecar}`)
      .then((text) => {
        const parsed = parseAnnotations(text);
        return parsed.annotations && annotationMachineOf(parsed.annotations) === "rom"
          ? parsed.annotations
          : undefined;
      })
      .catch(() => undefined);
    shippedSidecars.set(sidecar, pending);
  }
  return pending;
}

/** The bytes of the ROM a shipped sidecar describes: the file it is named after. */
function readShippedRomPage(
  files: RomLoaderFiles,
  sidecar: string,
  page: number
): Promise<Uint8Array | undefined> {
  const romFile = sidecar.replace(/\.dis$/i, "");
  let pending = shippedRomBytes.get(romFile);
  if (!pending) {
    pending = files.readBinaryFile(`${SHIPPED_ROM_FOLDER}/${romFile}`).catch(() => undefined);
    shippedRomBytes.set(romFile, pending);
  }
  return pending.then((bytes) => bytes?.subarray(page * 0x4000, Math.min(bytes.length, (page + 1) * 0x4000)));
}

/** Forget the shipped files read so far. For tests, and after a shipped sidecar changes. */
export function resetRomAnnotationCachesForTests(): void {
  shippedIndex = undefined;
  shippedSidecars.clear();
  shippedRomBytes.clear();
  bindingCache.clear();
}

// ------------------------------------------------------------------------------------------------
// Loading

/** Where a partition's user layer is written. */
export async function userLayerPathOf(
  files: RomLoaderFiles,
  source: RomSource
): Promise<{ path: string; page: number }> {
  if (source.path && !isShippedRomPath(source.path)) {
    const beside = `${source.path}.dis`;
    try {
      if (await files.canWriteBeside(beside)) return { path: beside, page: source.page };
    } catch {
      // --- Fall back to the overlay
    }
  }
  return { path: await files.resolveKliveHomePath(romOverlayRelativePath(source.crc32)), page: 0 };
}

async function readUserLayer(
  projectService: Pick<IProjectService, "readFileContent">,
  path: string
): Promise<ProgramAnnotations | undefined> {
  const inSession = peekAnnotationSession(path);
  if (inSession) return inSession;
  const state = await loadAnnotationSidecar(projectService, { fullPath: path });
  return state.status === "loaded" && state.annotations && annotationMachineOf(state.annotations) === "rom"
    ? state.annotations
    : undefined;
}

/** A shipped layer applied by byte binding, cached by (sidecar, page, target CRC). */
async function boundShippedLayer(
  files: RomLoaderFiles,
  sidecar: string,
  page: number,
  source: RomSource
): Promise<{ layer: RomLayer; binding: RomBinding } | undefined> {
  const annotations = await readShippedSidecar(files, sidecar);
  const bank = annotations?.banks[String(page)];
  if (!annotations || !bank || !source.bytes) return undefined;
  const key = `${sidecar}:${page}:${source.crc32}`;
  let binding = bindingCache.get(key);
  if (!binding) {
    const described = await readShippedRomPage(files, sidecar, page);
    if (!described) return undefined;
    binding = bindRomPage(bank, described, source.bytes);
    bindingCache.set(key, binding);
  }
  return {
    layer: {
      kind: "shipped",
      path: `${SHIPPED_ROM_FOLDER}/${sidecar}`,
      origin: `ROM: ${sidecar.replace(/\.dis$/i, "")}`,
      annotations,
      page,
      bound: binding.bound,
      boundRegions: binding.boundRegions
    },
    binding
  };
}

/** Every ROM partition's layers, for the machine running now. */
export async function loadRomPartitions(deps: RomLoaderDeps): Promise<RomPartitionInfo[]> {
  let sources: Record<number, RomSource>;
  try {
    sources = await deps.emuApi.getRomSources(true);
  } catch {
    return [];
  }
  const index = await readShippedIndex(deps.files);
  const result: RomPartitionInfo[] = [];

  for (const [key, source] of Object.entries(sources ?? {})) {
    const partition = Number(key);
    const layers: RomLayer[] = [];
    const bindings: RomPartitionInfo["bindings"] = [];

    // --- 1. The user's own
    const user = await userLayerPathOf(deps.files, source);
    const userAnnotations = await readUserLayer(deps.projectService, user.path);
    if (userAnnotations) {
      layers.push({
        kind: "user",
        path: user.path,
        origin: "Your ROM annotations",
        annotations: userAnnotations,
        page: user.page
      });
    }

    // --- 2. The shipped one, by CRC; its inherited sidecars byte-bound after it
    const entry = index[source.crc32];
    if (entry) {
      const shipped = await readShippedSidecar(deps.files, entry.sidecar);
      if (shipped) {
        layers.push({
          kind: "shipped",
          path: `${SHIPPED_ROM_FOLDER}/${entry.sidecar}`,
          origin: `ROM: ${entry.sidecar.replace(/\.dis$/i, "")}`,
          annotations: shipped,
          page: entry.page
        });
        const inherits = (shipped as ProgramAnnotations & { inherits?: { sidecar: string; page: number }[] })
          .inherits;
        for (const inherited of inherits ?? []) {
          const bound = await boundShippedLayer(deps.files, inherited.sidecar, inherited.page, source);
          if (bound) {
            layers.push(bound.layer);
            bindings.push({ sidecar: inherited.sidecar, binding: bound.binding });
          }
        }
      }
    } else if (isBasic48RomPage(deps.machineId, partition, source)) {
      // --- Q7: an unknown 48K BASIC page gets the 48K ROM's annotations where the bytes match
      const bound = await boundShippedLayer(deps.files, SP48_SIDECAR, 0, source);
      if (bound) {
        layers.push(bound.layer);
        bindings.push({ sidecar: SP48_SIDECAR, binding: bound.binding });
      }
    }

    // --- The bytes were needed for binding only; the store keeps the identity
    const { bytes: _bytes, ...identity } = source;
    result.push({ partition, source: identity, userPath: user.path, userPage: user.page, layers, bindings });
  }
  return result;
}
