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
 * Finding a ROM page's sidecar (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` §4.2, which amends §5.2-§5.3
 * of `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`).
 *
 * **One sidecar is in effect for a page**, chosen in this order:
 *
 * 1. **a working copy** — `<Klive home>/RomAnnotations/<sidecar>` for a ROM Klive ships (named
 *    exactly like the shipped file, so it can be copied into `src/public/roms/` unchanged), or
 *    `<path>.dis` beside a custom ROM file. It is the only editable one, and it *replaces* the shipped
 *    sidecar rather than being laid over it. It applies only when its `pages` name this page's CRC.
 * 2. **the shipped sidecar**, found by CRC in the shipped index, read-only.
 *
 * Its `inherits` are added after it, byte-bound, and resolved through the same lookup — so a working
 * copy of `sp48.rom.dis` reaches every ROM that inherits it. A 48K BASIC page whose CRC is unknown
 * (Q7) gets the effective `sp48.rom.dis` byte-bound in the same way.
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
  /** Where this page's working copy is, or would be made by `rom-ann-new`. */
  workingPath: string;
  /** The page within the working copy's banks. */
  workingPage: number;
  /** Whether the working copy exists (and names this page): only then can the page be edited. */
  hasWorkingCopy: boolean;
  /** The shipped sidecar that describes this page, when Klive ships one (`sp48.rom.dis`). */
  shippedSidecar?: string;
  /** The layers in effect: the page's sidecar first, then its byte-bound inherited ones. */
  layers: RomLayer[];
  /** For a byte-bound layer: how many labels bound, for `ann-info`. */
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

/** The folder of the working copies, in the Klive home folder. */
export const WORKING_ROM_FOLDER = "RomAnnotations";

/** A working copy in the Klive home folder, by its file name (`sp48.rom.dis`). */
export function workingCopyRelativePath(sidecar: string): string {
  return `${WORKING_ROM_FOLDER}/${sidecar}`;
}

/**
 * The additive overlay earlier builds wrote, by CRC (`RomAnnotations/<crc32>.rom.dis`). Read once,
 * to migrate it into a working copy (`romWorkingCopy.ts`), and never written again.
 */
export function legacyOverlayRelativePath(crc32: string): string {
  return `${WORKING_ROM_FOLDER}/${crc32}.rom.dis`;
}

// ------------------------------------------------------------------------------------------------
// Shipped files, read once

let shippedIndex: Promise<ShippedRomIndex> | undefined;
const shippedSidecars = new Map<string, Promise<ProgramAnnotations | undefined>>();
const shippedRomBytes = new Map<string, Promise<Uint8Array | undefined>>();
// --- Keyed by the sidecar model too: an edited working copy is a new model, and its bindings follow
const bindingCache = new WeakMap<ProgramAnnotations, Map<string, RomBinding>>();

/** The shipped index, read once. */
export function readShippedIndex(
  files: Pick<RomLoaderFiles, "readTextFile">
): Promise<ShippedRomIndex> {
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
}

// ------------------------------------------------------------------------------------------------
// Loading

/** The file name of a path, either separator. */
function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Where a page's working copy is (or would be made), and the shipped sidecar it would start from.
 *
 * A page Klive ships a sidecar for is named after that sidecar — whichever file the bytes were
 * loaded from — so the working copy is the one file that can be copied back. A custom ROM's goes
 * beside it, falling back to the Klive home folder when that folder is not writable.
 */
export async function workingCopyOf(
  files: RomLoaderFiles,
  source: RomSource,
  index?: ShippedRomIndex
): Promise<{ path: string; page: number; shippedSidecar?: string }> {
  const shipped = (index ?? (await readShippedIndex(files)))[source.crc32];
  if (shipped) {
    return {
      path: await files.resolveKliveHomePath(workingCopyRelativePath(shipped.sidecar)),
      page: shipped.page,
      shippedSidecar: shipped.sidecar
    };
  }
  if (source.path && !isShippedRomPath(source.path)) {
    const beside = `${source.path}.dis`;
    try {
      if (await files.canWriteBeside(beside)) return { path: beside, page: source.page };
    } catch {
      // --- Fall back to the Klive home folder
    }
  }
  const name = source.path ? `${fileNameOf(source.path)}.dis` : `${source.crc32}.rom.dis`;
  return { path: await files.resolveKliveHomePath(workingCopyRelativePath(name)), page: source.page };
}

/** A ROM sidecar read through its session (an edit in flight is what counts), or `undefined`. */
export async function readRomSidecarFile(
  projectService: Pick<IProjectService, "readFileContent">,
  path: string
): Promise<ProgramAnnotations | undefined> {
  const inSession = peekAnnotationSession(path);
  if (inSession) return annotationMachineOf(inSession) === "rom" ? inSession : undefined;
  const state = await loadAnnotationSidecar(projectService, { fullPath: path });
  return state.status === "loaded" && state.annotations && annotationMachineOf(state.annotations) === "rom"
    ? state.annotations
    : undefined;
}

/**
 * The CRC a ROM sidecar records for a page, when it records one.
 *
 * Read from the file, not the model: `pages` is a ROM sidecar's own key, which the annotation model
 * does not carry — and no edit changes it, so the file is always current for it.
 */
export async function pageCrcOf(
  projectService: Pick<IProjectService, "readFileContent">,
  path: string,
  page: number
): Promise<string | undefined> {
  try {
    const text = await projectService.readFileContent(path, false);
    if (typeof text !== "string") return undefined;
    return JSON.parse(text)?.pages?.[String(page)]?.crc32;
  } catch {
    return undefined;
  }
}

/** The `inherits` a ROM sidecar declares. */
function inheritsOf(annotations: ProgramAnnotations): { sidecar: string; page: number }[] {
  return (annotations as ProgramAnnotations & { inherits?: { sidecar: string; page: number }[] }).inherits ?? [];
}

/** A shipped sidecar's effective model: its working copy when there is one, else the shipped file. */
async function effectiveSidecar(
  deps: RomLoaderDeps,
  sidecar: string
): Promise<{ annotations: ProgramAnnotations; path: string; working: boolean } | undefined> {
  const workingPath = await deps.files.resolveKliveHomePath(workingCopyRelativePath(sidecar));
  const working = await readRomSidecarFile(deps.projectService, workingPath);
  if (working) return { annotations: working, path: workingPath, working: true };
  const shipped = await readShippedSidecar(deps.files, sidecar);
  return shipped ? { annotations: shipped, path: `${SHIPPED_ROM_FOLDER}/${sidecar}`, working: false } : undefined;
}

/** A sidecar applied by byte binding: inherited (`inherits`) or for an unknown 48K BASIC page (Q7). */
async function boundLayer(
  deps: RomLoaderDeps,
  sidecar: string,
  page: number,
  source: RomSource
): Promise<{ layer: RomLayer; binding: RomBinding } | undefined> {
  const effective = await effectiveSidecar(deps, sidecar);
  const bank = effective?.annotations.banks[String(page)];
  if (!effective || !bank || !source.bytes) return undefined;
  const key = `${sidecar}:${page}:${source.crc32}`;
  let bindings = bindingCache.get(effective.annotations);
  if (!bindings) {
    bindings = new Map();
    bindingCache.set(effective.annotations, bindings);
  }
  let binding = bindings.get(key);
  if (!binding) {
    // --- Bound against the bytes the sidecar was written for: its ROM is the shipped one either way
    const described = await readShippedRomPage(deps.files, sidecar, page);
    if (!described) return undefined;
    binding = bindRomPage(bank, described, source.bytes);
    bindings.set(key, binding);
  }
  return {
    layer: {
      kind: effective.working ? "working" : "shipped",
      path: effective.path,
      origin: originOf(sidecar, effective.working),
      annotations: effective.annotations,
      page,
      bound: binding.bound,
      boundRegions: binding.boundRegions
    },
    binding
  };
}

/** What a tooltip says a name came from: "ROM: sp48.rom (working copy)", "ROM: sp48.rom". */
function originOf(sidecar: string, working: boolean): string {
  return `ROM: ${fileNameOf(sidecar).replace(/\.dis$/i, "")}${working ? " (working copy)" : ""}`;
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

    // --- 1. The working copy, when it describes these very bytes
    const working = await workingCopyOf(deps.files, source, index);
    const workingAnnotations = await readRomSidecarFile(deps.projectService, working.path);
    const recordedCrc = workingAnnotations
      ? await pageCrcOf(deps.projectService, working.path, working.page)
      : undefined;
    const hasWorkingCopy = !!workingAnnotations && (!recordedCrc || recordedCrc === source.crc32);
    let primary: ProgramAnnotations | undefined;
    if (hasWorkingCopy) {
      primary = workingAnnotations;
      layers.push({
        kind: "working",
        path: working.path,
        origin: originOf(working.shippedSidecar ?? fileNameOf(working.path), true),
        annotations: workingAnnotations!,
        page: working.page
      });
    } else if (working.shippedSidecar) {
      // --- 2. Otherwise the shipped one, by CRC
      const shipped = await readShippedSidecar(deps.files, working.shippedSidecar);
      if (shipped) {
        primary = shipped;
        layers.push({
          kind: "shipped",
          path: `${SHIPPED_ROM_FOLDER}/${working.shippedSidecar}`,
          origin: originOf(working.shippedSidecar, false),
          annotations: shipped,
          page: working.page
        });
      }
    }

    // --- Its inherited sidecars, byte-bound after it; an unknown 48K BASIC page gets sp48 (Q7)
    const inherited = primary ? inheritsOf(primary) : [];
    const bound =
      inherited.length > 0
        ? inherited
        : !working.shippedSidecar && isBasic48RomPage(deps.machineId, partition, source)
          ? [{ sidecar: SP48_SIDECAR, page: 0 }]
          : [];
    for (const entry of bound) {
      const layer = await boundLayer(deps, entry.sidecar, entry.page, source);
      if (layer) {
        layers.push(layer.layer);
        bindings.push({ sidecar: entry.sidecar, binding: layer.binding });
      }
    }

    // --- The bytes were needed for binding only; the store keeps the identity
    const { bytes: _bytes, ...identity } = source;
    result.push({
      partition,
      source: identity,
      workingPath: working.path,
      workingPage: working.page,
      hasWorkingCopy,
      ...(working.shippedSidecar ? { shippedSidecar: working.shippedSidecar } : {}),
      layers,
      bindings
    });
  }
  return result;
}
