import type { ProfileLayout } from "./profileLayout";
import { scorpionProfileLayout, sp128ProfileLayout } from "./sp128";
import { sp48ProfileLayout } from "./sp48";
import { spp3eProfileLayout } from "./spp3e";
import { timexProfileLayout } from "./timex";
import { z88ProfileLayout } from "./z88";
import { zx8081ProfileLayout } from "./zx8081";
import { zxnextProfileLayout } from "./zxnext";

/*
 * The per-core profile layouts (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.2), by machine id:
 * models share their core's layout, as they share its history context decoder.
 */
const layouts: Record<string, ProfileLayout> = {
  sp48: sp48ProfileLayout,
  timex: timexProfileLayout,
  sp128: sp128ProfileLayout,
  scorpion: scorpionProfileLayout,
  spp3e: spp3eProfileLayout,
  z88: z88ProfileLayout,
  zxnext: zxnextProfileLayout,
  zx80: zx8081ProfileLayout,
  zx81: zx8081ProfileLayout
};

/** The profile layout of a machine; undefined for a machine whose core does not profile */
export function profileLayoutOf(machineId: string | undefined): ProfileLayout | undefined {
  return machineId ? layouts[machineId] : undefined;
}
