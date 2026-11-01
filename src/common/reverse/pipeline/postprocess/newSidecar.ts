import { romCrc32, type RomPageKind } from "@common/roms/romIdentity";
import type { RawRomSidecar } from "@common/roms/romAnnotationTools";

/*
 * A base for a ROM that has no sidecar yet (EXDOS 1.3 is the first, plan D8): the shipped files'
 * top-level keys, and one bank per page that is all code. `compile` lays the `.ann` files over it.
 */

export type NewSidecarPage = {
  page: number;
  bytes: Uint8Array;
  /** The address the page runs at: `offsetIndex` is its 16K slot when it is a multiple of 16K. */
  origin: number;
  /** The page's display name; `<file> page <n>` when absent. */
  name?: string;
  kind?: RomPageKind;
};

/** A level-0 sidecar for `fileName` with the given pages. */
export function newRomSidecar(fileName: string, pages: readonly NewSidecarPage[]): RawRomSidecar {
  const sidecar: RawRomSidecar = {
    schemaVersion: 3,
    machine: "rom",
    source: { fileName },
    authoring: ".ai/rom-annotations/README.md",
    level: 0,
    pages: {},
    banks: {},
    provenance: {}
  };
  for (const page of pages) addRomSidecarPage(sidecar, page);
  return sidecar;
}

/** Adds an all-code bank for a page the sidecar does not describe yet; throws when it does. */
export function addRomSidecarPage(sidecar: RawRomSidecar, page: NewSidecarPage): void {
  const key = String(page.page);
  if (sidecar.banks?.[key]) throw new Error(`The sidecar already has page ${page.page}`);
  sidecar.pages = { ...(sidecar.pages ?? {}), [key]: { crc32: romCrc32(page.bytes), name: page.name ?? `${sidecar.source?.fileName} page ${page.page}` } };
  sidecar.banks = {
    ...(sidecar.banks ?? {}),
    [key]: {
      offsetIndex: page.origin % 0x4000 === 0 ? page.origin / 0x4000 : 0,
      regions: [{ start: 0, end: page.bytes.length - 1, type: "disassemble" }],
      localLabels: [],
      lineAnnotations: {}
    }
  };
}
