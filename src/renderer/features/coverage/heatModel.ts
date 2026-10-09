import {
  PF_EXECUTED,
  PF_READ,
  PF_SELF_MODIFIED,
  PF_WRITTEN,
  type ProfileView
} from "@common/profile/profileTypes";

/*
 * The memory view's heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D14). Pure: a profile view
 * (flags and counts of the 64K, or of a partition) becomes one byte per address - a step on a
 * five-step ramp and the hue it is drawn in.
 *
 * - The step is log2 of the count, scaled to the view's largest count of the mode, so a byte touched
 *   once and the hottest loop are always both visible: step 1 is "touched", step 5 "the hottest".
 * - "All" draws each byte in the hue of its dominant count (execute, read or write) at that count's
 *   step.
 * - A page whose counters the pool could not keep (T6) draws its flags alone at step 1.
 */

export type HeatMode = "off" | "exec" | "read" | "write" | "all";

export const HEAT_MODES: readonly HeatMode[] = ["off", "exec", "read", "write", "all"];

/** The hue of a heat byte (bits 4-5) */
export const HEAT_KIND_EXEC = 0;
export const HEAT_KIND_READ = 1;
export const HEAT_KIND_WRITE = 2;

/** Bit 6: the byte was self-modified (D9) */
export const HEAT_SMC = 0x40;

/** A heat byte's ramp step (0: not drawn, 1-5) */
export function heatStep(heat: number): number {
  return heat & 0x07;
}

/** A heat byte's hue: `HEAT_KIND_EXEC`, `_READ` or `_WRITE` */
export function heatKind(heat: number): number {
  return (heat >> 4) & 0x03;
}

const FLAG_OF_KIND = [PF_EXECUTED, PF_READ, PF_WRITTEN];

/** The ramp step of a count against the largest count of its mode (both > 0) */
export function rampStep(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 1;
  const step = 1 + Math.floor((4 * Math.log2(count)) / Math.log2(max));
  return Math.max(1, Math.min(5, step));
}

/**
 * One heat byte per byte of the view (`heatStep`, `heatKind`, `HEAT_SMC`)
 * @returns undefined when the mode is "off"
 */
export function buildHeatSteps(view: ProfileView | undefined, mode: HeatMode): Uint8Array | undefined {
  if (!view || mode === "off") return undefined;
  const n = view.flags.length;
  const heat = new Uint8Array(n);
  const counts = view.counts;
  const kinds = mode === "all" ? [HEAT_KIND_EXEC, HEAT_KIND_READ, HEAT_KIND_WRITE] : [kindOf(mode)];
  const arrays = counts ? [counts.exec, counts.read, counts.write] : undefined;
  const max = [0, 0, 0];
  if (arrays) {
    for (const k of kinds) {
      const a = arrays[k];
      for (let i = 0; i < n; i++) if (a[i] > max[k]) max[k] = a[i];
    }
  }
  for (let i = 0; i < n; i++) {
    const flags = view.flags[i];
    if (flags === 0) continue;
    let bestKind = -1;
    let bestStep = 0;
    let bestCount = -1;
    const counted = !!arrays && counts!.counted[i] === 1;
    for (const k of kinds) {
      if ((flags & FLAG_OF_KIND[k]) === 0) continue;
      if (!counted) {
        // --- Flags without counts: drawn at step 1 (T6)
        if (bestKind < 0) {
          bestKind = k;
          bestStep = 1;
        }
        continue;
      }
      const count = arrays![k][i];
      if (count > bestCount) {
        bestCount = count;
        bestKind = k;
        bestStep = Math.max(1, rampStep(count, max[k]));
      }
    }
    if (bestKind < 0) continue;
    heat[i] = bestStep | (bestKind << 4) | (flags & PF_SELF_MODIFIED ? HEAT_SMC : 0);
  }
  return heat;
}

function kindOf(mode: HeatMode): number {
  return mode === "read" ? HEAT_KIND_READ : mode === "write" ? HEAT_KIND_WRITE : HEAT_KIND_EXEC;
}

/** The tooltip text of one byte: `E 12 · R 340 · W 2`, the SMC marker, or why there are no counts */
export function heatTooltip(view: ProfileView | undefined, index: number): string | undefined {
  if (!view) return undefined;
  const flags = view.flags[index];
  if (!flags) return undefined;
  const parts: string[] = [];
  const counts = view.counts;
  if (counts && counts.counted[index]) {
    parts.push(`E ${counts.exec[index].toLocaleString("en-US")}`);
    parts.push(`R ${counts.read[index].toLocaleString("en-US")}`);
    parts.push(`W ${counts.write[index].toLocaleString("en-US")}`);
  } else {
    if (flags & PF_EXECUTED) parts.push("executed");
    if (flags & PF_READ) parts.push("read");
    if (flags & PF_WRITTEN) parts.push("written");
    if (counts) parts.push("counts not kept for this page");
  }
  if (flags & PF_SELF_MODIFIED) parts.push("self-modified");
  return parts.join(" · ");
}
