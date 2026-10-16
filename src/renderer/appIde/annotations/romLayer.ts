import type { BankAnnotation, ProgramAnnotations } from "./programAnnotations";

/*
 * One layer of a ROM page's annotations: a ROM sidecar (`<rom file>.dis`, `machine: "rom"`) seen
 * from the page it describes (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` §4.2).
 *
 * A page has **one** sidecar of its own: its **working** copy (editable, in
 * `<Klive home>/RomAnnotations/` or beside a custom ROM file) when there is one, otherwise the
 * **shipped** sidecar (read-only). The layers after it are the sidecars it inherits, applied by byte
 * binding: such a layer names only the offsets whose bytes it was checked against. An earlier layer
 * wins at the same offset.
 */

export type RomLayerKind = "working" | "shipped";

export type RomLayer = {
  kind: RomLayerKind;
  /** The sidecar file. */
  path: string;
  /** What a tooltip says the name came from: "ROM: sp48.rom", "ROM: sp48.rom (working copy)". */
  origin: string;
  /** The sidecar. */
  annotations: ProgramAnnotations;
  /** The 16K page within the sidecar's ROM file this partition holds. */
  page: number;
  /**
   * The page offsets whose label and comments apply here, when the layer is byte-bound; `undefined`
   * when the whole page applies (the bytes are the very ones the sidecar was written for).
   */
  bound?: ReadonlySet<number>;
  /** The regions that apply under byte binding (only those whose bytes all match). */
  boundRegions?: ReadonlySet<number>;
};

/** The page's annotation in a layer, or `undefined` when the sidecar says nothing about it. */
export function romLayerBank(layer: RomLayer): BankAnnotation | undefined {
  return layer.annotations.banks[String(layer.page)];
}

/** Whether a layer's entry at a page offset applies here. */
export function romLayerApplies(layer: RomLayer, offset: number): boolean {
  return !layer.bound || layer.bound.has(offset);
}

/** The ROM layers of a ROM partition (its own sidecar first), or none. */
export type RomLayersOf = (partition: number) => readonly RomLayer[];
