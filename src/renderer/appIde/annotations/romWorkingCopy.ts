import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { MainApi } from "@common/messaging/MainApi";

import { formatRomSidecar, type RawRomSidecar } from "@common/roms/romAnnotationTools";
import { romCrc32 } from "@common/roms/romIdentity";
import { overlayRegion } from "./annotatedDisassembly";
import { romSidecarText } from "./romSidecarWriter";
import { SHIPPED_ROM_FOLDER, legacyOverlayRelativePath, type RomPartitionInfo } from "./romAnnotationLoader";
import type { AnnotationRegion } from "./programAnnotations";

/*
 * Making a ROM page's working copy (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` R8, T5, §4.2).
 *
 * A working copy is the file that is later copied into `src/public/roms/` unchanged, so it starts as
 * exactly the shipped sidecar — the same bytes a hand copy would give — or, for a ROM Klive ships no
 * sidecar for, as a fresh one that names its page by CRC and carries nothing yet.
 *
 * Beside it, `<working copy>.base` records the CRC-32 of the shipped text it started from. It is a
 * file of its own rather than a key in the sidecar, so the working copy stays byte-for-byte what
 * `rom:annotations` writes; the editor compares it with the shipped file Klive has now and says so
 * when an update has moved the shipped sidecar on (T5).
 */

type Files = Pick<MainApi, "readTextFile" | "renameFileEntry">;
type Project = Pick<IProjectService, "readFileContent" | "saveFileContent">;

/** What a working copy is made for. */
export type WorkingCopyTarget = {
  workingPath: string;
  workingPage: number;
  shippedSidecar?: string;
  crc32: string;
  size: number;
  /** The ROM's file name, for `source.fileName` and the page name of a fresh sidecar. */
  romName: string;
};

/** The target of a ROM partition the IDE has loaded. */
export function workingCopyTargetOf(info: RomPartitionInfo): WorkingCopyTarget {
  const romName = info.shippedSidecar
    ? info.shippedSidecar.replace(/\.dis$/i, "")
    : (info.source.path?.split(/[\\/]/).pop() ?? `${info.source.crc32}.rom`);
  return {
    workingPath: info.workingPath,
    workingPage: info.workingPage,
    ...(info.shippedSidecar ? { shippedSidecar: info.shippedSidecar } : {}),
    crc32: info.source.crc32,
    size: info.source.size,
    romName
  };
}

/** The `.base` file beside a working copy. */
export function baseFileOf(workingPath: string): string {
  return `${workingPath}.base`;
}

/** A ROM sidecar with nothing in it yet, for a page Klive ships no sidecar for. */
export function freshRomSidecar(target: WorkingCopyTarget): string {
  const page = String(target.workingPage);
  return formatRomSidecar({
    schemaVersion: 3,
    machine: "rom",
    source: { fileName: target.romName },
    authoring: ".ai/rom-annotations/README.md",
    level: 0,
    pages: { [page]: { crc32: target.crc32, name: target.romName } },
    banks: {
      [page]: {
        offsetIndex: 0,
        regions: [{ start: 0, end: Math.max(0, Math.min(target.size, 0x4000) - 1), type: "disassemble" }]
      }
    }
  });
}

async function exists(project: Project, path: string): Promise<boolean> {
  try {
    const contents = await project.readFileContent(path, false);
    return typeof contents === "string";
  } catch {
    return false;
  }
}

async function readShippedText(files: Files, sidecar: string): Promise<string | undefined> {
  try {
    return await files.readTextFile(`${SHIPPED_ROM_FOLDER}/${sidecar}`);
  } catch {
    return undefined;
  }
}

/**
 * Make the working copy, or say why not.
 *
 * Never overwrites: a working copy is somebody's work, and the only way to start over is to delete
 * it deliberately.
 */
export async function createWorkingCopy(
  files: Files,
  project: Project,
  target: WorkingCopyTarget
): Promise<{ created: true; path: string; from: "shipped" | "fresh" } | { created: false; reason: string }> {
  if (await exists(project, target.workingPath)) {
    return { created: false, reason: `${target.workingPath} already exists.` };
  }
  const shippedText = target.shippedSidecar ? await readShippedText(files, target.shippedSidecar) : undefined;
  if (shippedText !== undefined) {
    await project.saveFileContent(target.workingPath, shippedText);
    await project.saveFileContent(baseFileOf(target.workingPath), `${shippedCrcOf(shippedText)}\n`);
    return { created: true, path: target.workingPath, from: "shipped" };
  }
  await project.saveFileContent(target.workingPath, freshRomSidecar(target));
  return { created: true, path: target.workingPath, from: "fresh" };
}

/** The CRC-32 of a shipped sidecar's text, as `.base` records it. */
export function shippedCrcOf(text: string): string {
  return romCrc32(new TextEncoder().encode(text));
}

/**
 * Whether the shipped sidecar has changed since the working copy was made from it: `undefined` when
 * that cannot be told (no `.base`, or no shipped file), so nothing is claimed.
 */
export async function shippedChangedSince(
  files: Files,
  project: Project,
  workingPath: string,
  shippedSidecar: string
): Promise<boolean | undefined> {
  let base: string;
  try {
    const contents = await project.readFileContent(baseFileOf(workingPath), false);
    if (typeof contents !== "string") return undefined;
    base = contents.trim();
  } catch {
    return undefined;
  }
  const shippedText = await readShippedText(files, shippedSidecar);
  if (shippedText === undefined || !base) return undefined;
  return shippedCrcOf(shippedText) !== base;
}

// ------------------------------------------------------------------------------------------------
// The additive overlays earlier builds wrote

/**
 * The working copy an old additive overlay becomes: the shipped sidecar (or a fresh one) with the
 * overlay's entries laid over it, the overlay winning at the same offset — which is how they were
 * shown. Each entry the overlay added is recorded as `observed`: it was the user's own work.
 *
 * Pure: the merge is tested without files.
 */
export function mergeLegacyOverlay(baseText: string, overlay: RawRomSidecar, page: number): string {
  const base: RawRomSidecar = JSON.parse(baseText);
  const key = String(page);
  const bank = { ...(base.banks?.[key] ?? { offsetIndex: 0, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }] }) };
  const added = overlay.banks?.[String(Object.keys(overlay.banks ?? {})[0] ?? "0")] ?? {};

  if (added.comment) bank.comment = added.comment;
  const overlayLabels: { name: string; value: number }[] = added.localLabels ?? [];
  if (overlayLabels.length > 0) {
    const taken = new Set(overlayLabels.flatMap((label) => [`o${label.value}`, `n${label.name}`]));
    bank.localLabels = [
      ...(bank.localLabels ?? []).filter(
        (label: { name: string; value: number }) => !taken.has(`o${label.value}`) && !taken.has(`n${label.name}`)
      ),
      ...overlayLabels.map((label) => ({ name: label.name, value: label.value }))
    ];
  }
  for (const field of ["lineAnnotations", "operandReferences"] as const) {
    if (added[field] && Object.keys(added[field]).length > 0) {
      bank[field] = { ...(bank[field] ?? {}), ...added[field] };
    }
  }
  let regions: AnnotationRegion[] = bank.regions ?? [];
  for (const region of (added.regions ?? []) as AnnotationRegion[]) {
    if (region.type === "disassemble") continue;
    regions = overlayRegion(regions, region);
  }
  bank.regions = regions;

  return romSidecarText(base, { ...(base.banks ?? {}), [key]: bank }, "observed");
}

/**
 * Turn each old `<crc32>.rom.dis` overlay of a page without a working copy into one, keeping the old
 * file as `<crc32>.rom.dis.bak`. Returns the working copies made, so the caller can reload.
 */
export async function migrateLegacyOverlays(
  files: Files & Pick<MainApi, "resolveKliveHomePath">,
  project: Project,
  partitions: readonly RomPartitionInfo[]
): Promise<string[]> {
  const migrated: string[] = [];
  for (const info of partitions) {
    if (info.hasWorkingCopy) continue;
    const legacyPath = await files.resolveKliveHomePath(legacyOverlayRelativePath(info.source.crc32));
    // --- A custom ROM's working copy can be named exactly like its old overlay: then it *is* one
    if (legacyPath === info.workingPath) continue;
    let overlay: RawRomSidecar;
    try {
      const text = await project.readFileContent(legacyPath, false);
      if (typeof text !== "string") continue;
      overlay = JSON.parse(text);
    } catch {
      continue;
    }
    if (overlay?.machine !== "rom") continue;

    const target = workingCopyTargetOf(info);
    const shippedText = target.shippedSidecar ? await readShippedText(files, target.shippedSidecar) : undefined;
    const merged = mergeLegacyOverlay(shippedText ?? freshRomSidecar(target), overlay, target.workingPage);
    await project.saveFileContent(target.workingPath, merged);
    if (shippedText !== undefined) {
      await project.saveFileContent(baseFileOf(target.workingPath), `${shippedCrcOf(shippedText)}\n`);
    }
    try {
      await files.renameFileEntry(legacyPath, `${legacyPath}.bak`);
    } catch {
      // --- Left in place: it is read only when there is no working copy, which there now is
    }
    migrated.push(target.workingPath);
  }
  return migrated;
}
