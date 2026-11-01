import { romKindUsesZ80N, type RomPageKind } from "@common/roms/romIdentity";

/*
 * The CPU a binary is decoded for (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` D2). Every image carries
 * it and every pipeline stage takes it from there: on a plain Z80 the Z80N's extra opcodes are `ED`
 * no-ops, so the wrong CPU changes instruction lengths and every boundary after them.
 */

export type Cpu = "z80" | "z80n";

export const CPUS: readonly Cpu[] = ["z80", "z80n"];

/** Whether `text` names a CPU (`z80` or `z80n`, any case). */
export function isCpu(text: string | undefined): text is Cpu {
  return text !== undefined && (CPUS as readonly string[]).includes(text.toLowerCase());
}

/** The CPU `text` names; throws on anything else, so a mistyped flag never decodes silently. */
export function parseCpu(text: string): Cpu {
  const lower = text.toLowerCase();
  if (!isCpu(lower)) throw new Error(`Unknown CPU "${text}": use ${CPUS.join(" or ")}`);
  return lower;
}

/** The CPU a ROM page of this kind runs on: the Next's pages are Z80N, every other ROM plain Z80. */
export function defaultCpuForRomKind(kind: RomPageKind | undefined): Cpu {
  return romKindUsesZ80N(kind) ? "z80n" : "z80";
}
