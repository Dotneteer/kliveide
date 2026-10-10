import type { BankAnnotation, ProgramAnnotations } from "./programAnnotations";

/*
 * One layer of a ROM page's annotations: a ROM sidecar (`<rom file>.dis`, `machine: "rom"`) seen
 * from the page it describes (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5).
 *
 * A paged ROM page has up to two: the **user** layer (the user's own labels, written by the IDE)
 * and the **shipped** layer (authored in the repository, read-only). The user layer wins at the same
 * offset. A shipped layer applied by byte binding (`inherits`, or a ROM whose CRC is unknown) names
 * only the offsets whose bytes it was checked against.
 */

export type RomLayerKind = "user" | "shipped";

export type RomLayer = {
  kind: RomLayerKind;
  /** The sidecar file. */
  path: string;
  /** What a tooltip says the name came from: "ROM: sp48.rom", "Your ROM annotations". */
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

/** The ROM layers of a ROM partition (user first), or none. */
export type RomLayersOf = (partition: number) => readonly RomLayer[];
