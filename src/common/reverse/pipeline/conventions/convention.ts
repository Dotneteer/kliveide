import type { RomPageKind } from "@common/roms/romIdentity";
import type { DecodedRow } from "../preprocess/decode";
import type { Reg } from "../preprocess/registers";

/*
 * Convention plug-ins (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.5, P5): what a family of ROMs does
 * over and over, written once. A plug-in is deterministic and tested, and it is held to the provenance
 * rule (D4) like an annotation: it knows only what the ROM's code, Klive's own runs and data, or an
 * official manual (an interface fact) show, and it names that source in `source`, which the cards
 * print next to every fact it adds.
 */

/** The registers a call that leaves the page takes and keeps (an OS call's documented contract). */
export type CallContract = {
  inputs: Reg[];
  changes: Reg[];
  keeps: Reg[];
  /** What the contract is, for the card ("EXOS call"). */
  name: string;
  /** Where it comes from (D4): a manual's section, or Klive's own notes written from the code. */
  source: string;
};

/** One table of packed texts, decoded. */
export type DecodedTextTable = {
  /** The table's label. */
  name: string;
  /** Its first byte (page offset). */
  start: number;
  /** The packing, as the plug-in names it. */
  packing: string;
  texts: string[];
  /** What each text answers, when the ROM says (an error number, an EXOS status code). */
  keys?: string[];
  /** Why decoding stopped early, when it did. */
  problem?: string;
};

export type ConventionContext = {
  bytes: Uint8Array;
  /** The page's labels by name (the sidecar's): plug-ins find their tables through them. */
  labels: ReadonlyMap<string, number>;
  /** The page's regions: a table ends where its data region ends. */
  regions?: readonly { start: number; end: number; type: string }[];
};

export type RomConvention = {
  id: string;
  description: string;
  /** The source of what the plug-in knows (D4). */
  source: string;
  appliesTo(kind: RomPageKind | undefined): boolean;
  /** The contract of a `CALL`/`RST` row whose target is outside the page. */
  callContract?(row: DecodedRow): CallContract | undefined;
  /** A note for a row on its card (what a restart does). */
  explain?(row: DecodedRow, kind: RomPageKind | undefined): string | undefined;
  /** The page's packed text tables, decoded. */
  texts?(context: ConventionContext): DecodedTextTable[];
};
