import { classifyBank } from "./classify";
import type { GraphicsLook } from "./graphicsDecode";

/*
 * Where graphics probably are (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.4, phase G4). Heuristics,
 * labelled as such in the UI — a list to start browsing from, not a classification.
 *
 * - **Fonts**: 96 characters of 8 bytes whose first is all zero (the space) and most of the rest are
 *   not, with the pixel margins fonts keep (most bytes leave the right-hand pixel clear).
 * - **The UDG area**: the 21 user-defined graphics at `$FF58`, when the bytes include it and it is
 *   not empty.
 * - **Read-only data**: data runs the CPU read but never executed or wrote, from the code/data
 *   classifier (G7.3), ranked by how often they were read.
 */

export type GraphicCandidateKind = "font" | "udg" | "data";

export type GraphicCandidate = {
  kind: GraphicCandidateKind;
  /** Offsets into the bytes, inclusive. */
  start: number;
  end: number;
  /** Higher is more likely; comparable only within a kind. */
  score: number;
  /** What the side list says. */
  description: string;
  /** The look to show it with. */
  look: Partial<GraphicsLook>;
};

const FONT_CHARS = 96;
const FONT_BYTES = FONT_CHARS * 8;
const UDG_ADDRESS = 0xff58;
const UDG_BYTES = 21 * 8;

/** Whether a font starts at `offset`: a blank space, then mostly drawn glyphs with fonts' margins. */
export function fontScore(bytes: ArrayLike<number>, offset: number): number {
  if (offset + FONT_BYTES > bytes.length) return 0;
  for (let i = 0; i < 8; i++) if (bytes[offset + i] !== 0) return 0;
  let drawn = 0;
  let margin = 0;
  let full = 0;
  for (let c = 1; c < FONT_CHARS; c++) {
    let any = false;
    for (let r = 0; r < 8; r++) {
      const b = bytes[offset + c * 8 + r];
      if (b !== 0) any = true;
      if ((b & 0x01) === 0) margin++;
      if (b === 0xff) full++;
    }
    if (any) drawn++;
  }
  const rows = (FONT_CHARS - 1) * 8;
  // --- Most glyphs drawn, most rows leaving the right-hand pixel clear, few solid rows
  if (drawn < 85 || margin < rows * 0.75 || full > rows * 0.1) return 0;
  return drawn / (FONT_CHARS - 1);
}

export function findGraphicCandidates(input: {
  bytes: Uint8Array;
  /** The address `bytes[0]` is at. */
  base: number;
  /** Coverage flags for the bytes, for the read-only data runs. */
  flags?: Uint8Array;
  /** Read counts per byte, to rank the data runs. */
  reads?: ArrayLike<number>;
  z80n?: boolean;
  /** The shortest data run worth listing. */
  minDataRun?: number;
}): GraphicCandidate[] {
  const { bytes, base } = input;
  const candidates: GraphicCandidate[] = [];
  const hex = (n: number) => `$${(n & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

  for (let offset = 0; offset + FONT_BYTES <= bytes.length; offset++) {
    const score = fontScore(bytes, offset);
    if (score === 0) continue;
    candidates.push({
      kind: "font",
      start: offset,
      end: offset + FONT_BYTES - 1,
      score,
      description: `Font at ${hex(base + offset)} (96 characters)`,
      look: { width: 1, height: 8, layout: "cells", mask: "none" }
    });
    offset += FONT_BYTES - 1;
  }

  const udg = UDG_ADDRESS - base;
  if (udg >= 0 && udg + UDG_BYTES <= bytes.length) {
    const area = bytes.subarray(udg, udg + UDG_BYTES);
    if (area.some((b) => b !== 0)) {
      candidates.push({
        kind: "udg",
        start: udg,
        end: udg + UDG_BYTES - 1,
        score: 1,
        description: `UDG area at ${hex(UDG_ADDRESS)} (21 graphics)`,
        look: { width: 1, height: 8, layout: "cells", mask: "none" }
      });
    }
  }

  if (input.flags) {
    const { runs } = classifyBank({ flags: input.flags, bytes, z80n: !!input.z80n });
    const minRun = input.minDataRun ?? 8;
    for (const run of runs) {
      if (run.class !== "data" || run.end - run.start + 1 < minRun) continue;
      // --- Read, never written: a buffer the program draws into is not where its graphics live
      let reads = 0;
      let written = false;
      for (let i = run.start; i <= run.end; i++) {
        if (input.flags[i] & 0x08) written = true;
        reads += input.reads?.[i] ?? (input.flags[i] & 0x04 ? 1 : 0);
      }
      if (written || reads === 0) continue;
      if (candidates.some((c) => c.kind === "font" && run.start <= c.end && run.end >= c.start)) continue;
      candidates.push({
        kind: "data",
        start: run.start,
        end: run.end,
        score: reads,
        description: `Read-only data at ${hex(base + run.start)}, ${run.end - run.start + 1} bytes, read ${reads}×`,
        look: {}
      });
    }
  }

  const order: Record<GraphicCandidateKind, number> = { font: 0, udg: 1, data: 2 };
  return candidates.sort((a, b) => order[a.kind] - order[b.kind] || b.score - a.score);
}
