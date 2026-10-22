import type { BankAnnotation, ProgramAnnotations } from "./programAnnotations";
import { bindRomPage } from "./romBinding";
import type { RomLayer } from "./romLayer";
import { mergeRomLayers } from "./symbolResolver";

/*
 * A ROM sidecar together with the sidecars it `inherits` (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`
 * §5.3-§5.4): `sp128-1.rom.dis` authors only where the 128K's ROM 1 differs from the 48K ROM, and
 * takes the rest from `sp48.rom.dis` by byte binding. The Disassembly view already lays the layers
 * over each other (`mergeRomLayers`); the readiness check, the level measure and Export as source
 * read the same merged page through this, so an inheriting sidecar is judged and exported as the
 * page it describes, not as its few own entries.
 */

/** A sidecar a ROM sidecar inherits: its effective model and the bytes of the page it describes. */
export type InheritedSidecar = { annotations: ProgramAnnotations; bytes: Uint8Array };

/** Reads an inherited sidecar's page: the working copy when there is one, else the shipped file. */
export type InheritedSidecarSource = (
  sidecar: string,
  page: number
) => Promise<InheritedSidecar | undefined>;

/** The sidecars a ROM sidecar declares it inherits. */
export function inheritsOf(annotations: unknown): { sidecar: string; page: number }[] {
  const inherits = (annotations as { inherits?: unknown })?.inherits;
  return Array.isArray(inherits)
    ? inherits.filter(
        (entry): entry is { sidecar: string; page: number } =>
          typeof entry?.sidecar === "string" && typeof entry?.page === "number"
      )
    : [];
}

/**
 * Each page of a sidecar merged with what it inherits: its own entries first, then the inherited
 * sidecars' entries whose bytes still match this page. A sidecar that inherits nothing comes back
 * as it is.
 *
 * @param pageBytes The bytes of the sidecar's own pages
 * @returns The merged model, and the inherited sidecars that could not be read
 */
export async function withInheritedEntries(
  annotations: ProgramAnnotations,
  pageBytes: (page: number) => Uint8Array | undefined,
  source: InheritedSidecarSource | undefined
): Promise<{ annotations: ProgramAnnotations; missing: string[] }> {
  const inherits = inheritsOf(annotations);
  if (inherits.length === 0 || !source) return { annotations, missing: [] };

  const missing: string[] = [];
  const inherited: { entry: { sidecar: string; page: number }; sidecar: InheritedSidecar }[] = [];
  for (const entry of inherits) {
    const sidecar = await source(entry.sidecar, entry.page);
    if (sidecar?.annotations.banks[String(entry.page)]) inherited.push({ entry, sidecar });
    else missing.push(entry.sidecar);
  }

  const banks: Record<string, BankAnnotation> = {};
  for (const [key, bank] of Object.entries(annotations.banks)) {
    const page = Number(key);
    const target = pageBytes(page);
    if (!target) {
      banks[key] = bank;
      continue;
    }
    const layers: RomLayer[] = [
      { kind: "working", path: "", origin: "", annotations, page }
    ];
    for (const { entry, sidecar } of inherited) {
      const inheritedBank = sidecar.annotations.banks[String(entry.page)]!;
      const binding = bindRomPage(inheritedBank, sidecar.bytes, target);
      layers.push({
        kind: "shipped",
        path: entry.sidecar,
        origin: entry.sidecar,
        annotations: sidecar.annotations,
        page: entry.page,
        bound: binding.bound,
        boundRegions: binding.boundRegions
      });
    }
    const merged = mergeRomLayers(layers);
    const mergedBank = merged?.annotations.banks[String(page)];
    banks[key] = mergedBank ? { ...mergedBank, offsetIndex: bank.offsetIndex } : bank;
  }
  return { annotations: { ...annotations, banks }, missing };
}
