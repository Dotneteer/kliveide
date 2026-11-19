import { describeDmaCommand, dmaGroupName } from "@common/zxnext/dma/dmaDecoder";
import { dmaPacing } from "@common/zxnext/dma/dmaState";
import { dmaProgramSummary, type DmaProgram, type DmaProgramSummary } from "@common/zxnext/dma/dmaProgram";
import { t } from "@common/i18n/i18n";

/*
 * The Klive assembler editor's `.dma` support (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §10.3): the hover
 * of a `.dma` line and the code lens over a program's first line. The programs are the assembler's own
 * (`AssemblerOutput.dmaPrograms`, through the language data of the last build), grouped by
 * `dmaProgram.ts` as its warnings are. Before a build there are none, so there is no hover and no lens.
 */

/** A `.dma` line, optionally after a `label:` */
export const DMA_LINE_RE = /^(?:[^:;"]+:\s*)?\s*\.?dma\s/i;

const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

function portText(value: number | "patched" | undefined, isIo: boolean | undefined): string {
  if (value === undefined) return "?";
  if (value === "patched") return t("panels.feature.dmaLens.patched");
  return isIo ? t("panels.feature.dmaLens.ioPort", { address: hex4(value) }) : hex4(value);
}

/** A program's summary as one line: route, bytes, mode, pacing, auto restart */
export function formatDmaSummary(s: DmaProgramSummary): string {
  const parts: string[] = [];
  if (s.aToB !== undefined) {
    const a = portText(s.portA, s.portAIsIo);
    const b = portText(s.portB, s.portBIsIo);
    parts.push(t("panels.feature.dmaLens.route", { from: s.aToB ? a : b, to: s.aToB ? b : a }));
  }
  if (s.blockLength === "patched") {
    parts.push(t("panels.feature.dmaLens.lengthPatched"));
  } else if (s.blockLength !== undefined) {
    parts.push(t("panels.feature.dmaLens.bytes", { count: s.blockLength === 0 ? 1 : s.blockLength }));
  }
  if (s.mode !== undefined) parts.push(["byte", "continuous", "burst", "mode 3"][s.mode]);
  if (s.prescaler) {
    // --- a byte reads one port and writes the other: 3 clocks each unless a timing byte says otherwise
    const pacing = dmaPacing(s.prescaler, 0, 6)!;
    parts.push(
      pacing.effective
        ? t("panels.feature.dmaLens.pacing", {
            prescaler: s.prescaler,
            clocks: pacing.periodClocks,
            rate: Math.round(pacing.exactHz)
          })
        : t("panels.feature.dmaLens.prescalerNone", { prescaler: s.prescaler })
    );
  }
  if (s.autoRestart) parts.push(t("panels.feature.dmaLens.autoRestart"));
  return t("panels.feature.dmaLens.title", { summary: parts.join(" · ") });
}

/** The code lenses: one over each program's first `.dma` line */
export function computeDmaCodeLenses(programs: readonly DmaProgram<number>[]): { lineNumber: number; title: string }[] {
  return programs.map((p) => ({ lineNumber: p.lines[0].key, title: formatDmaSummary(dmaProgramSummary(p)) }));
}

/**
 * The hover of a `.dma` line: each register group whose base byte the line emits, decoded, then the
 * program's summary. Null when the line is not in a program (no build yet, or not a `.dma` line).
 */
export function computeDmaHover(lineNumber: number, programs: readonly DmaProgram<number>[]): { contents: string[] } | null {
  for (const program of programs) {
    const line = program.lines.find((l) => l.key === lineNumber);
    if (!line) continue;
    const contents: string[] = [];
    for (const cmd of program.commands) {
      if (cmd.offset < line.offset || cmd.offset >= line.offset + line.length) continue;
      contents.push(`**${dmaGroupName(cmd.kind)}** · ${describeDmaCommand(cmd).replace(/^WR\d: /, "")} *(zxnDMA)*`);
    }
    if (contents.length === 0) {
      // --- the line's first byte belongs to an earlier group (the build warns, Z0388)
      contents.push(t("panels.feature.dmaLens.swallowed"));
    }
    contents.push(formatDmaSummary(dmaProgramSummary(program)));
    return { contents };
  }
  return null;
}
