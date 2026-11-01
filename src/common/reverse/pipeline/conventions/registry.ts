import type { RomPageKind } from "@common/roms/romIdentity";
import type { RomConvention } from "./convention";
import { enterpriseConvention } from "./enterprise";

/*
 * The convention plug-ins (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.5): the one place that lists
 * them. A new ROM family's plug-in is added here, with its tests and a `PROVENANCE.md` entry (D4).
 */

const CONVENTIONS: readonly RomConvention[] = [enterpriseConvention];

/** The plug-ins that apply to a ROM page of this kind. */
export function conventionsFor(kind: RomPageKind | undefined): RomConvention[] {
  return CONVENTIONS.filter((c) => c.appliesTo(kind));
}
