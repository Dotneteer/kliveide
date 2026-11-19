import type { NextDmaState } from "@common/zxnext/dma/dmaState";
import { hex6, portAddresses, type DmaModel } from "./dmaViewModel";

/*
 * The `dma` command's text (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3.2): the DMA panel's rows as plain
 * lines, for doc-shot recipes, tests and AI sessions. Console output, so English (dev/ai/i18n-guide.md
 * rule 9), with hardware terms throughout.
 */

const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

const HEADER_TEXT: Record<DmaModel["header"], string> = {
  deaf: "deaf",
  locked: "locked",
  holding: "holding the bus",
  steppedAside: "stepped aside",
  waiting: "waiting, bus free",
  starting: "starting",
  idle: "idle"
};

/** The DMA's state as lines of text */
export function formatDmaState(s: NextDmaState, m: DmaModel): string[] {
  const fmt = m.physical ? hex6 : hex4;
  const portLine = (name: "A" | "B") => {
    const p = name === "A" ? s.portA : s.portB;
    const a = portAddresses(s, name);
    return `${name}  start ${fmt(a.start)}  working ${fmt(a.working)}  ${p.isIo ? "I/O   " : "memory"}  ${p.step.padEnd(5)}  ${p.cycleClocks} clk`;
  };
  const dialect = s.dialect === "zxn" ? "zxnDMA ($6B)" : "Z80 DMA ($0B)";
  const mode = s.operatingMode === m.behavesAs ? s.operatingMode : `${s.operatingMode} (= ${m.behavesAs})`;
  const lines = [
    `${dialect} · ${HEADER_TEXT[m.header]}${m.finished ? " (block finished)" : ""} · ${mode} · ${s.aToB ? "A → B" : "B → A"} · ${m.bytesMoved} / ${m.bytesToMove}${s.autoRestart ? " · auto restart" : ""}`,
    portLine("A"),
    portLine("B")
  ];
  if (m.pacing) {
    lines.push(
      `prescaler ${s.prescaler} · nominal ${Math.round(m.pacing.nominalHz)} Hz · ` +
        (m.pacing.effective ? `exact ${m.pacing.periodClocks} T a byte (${Math.round(m.pacing.exactHz)} Hz)` : "no effect at this speed")
    );
  }
  const decoder = m.header === "deaf" ? "deaf" : m.pending ? `${m.pending.group} expects ${m.pending.roles.join(", ")}` : "ready";
  lines.push(`status ${hex2(m.status)} · read mask ${hex2(s.readMask)} · next read: ${s.nextRead} · decoder: ${decoder}`);
  lines.push(`steps aside for: ${m.stepAside.length > 0 ? m.stepAside.join(", ") : "none"}`);
  if (s.ddma) {
    const d = s.ddma;
    lines.push(
      `zxnDDMA flags ${hex2(d.flags)}${m.ddmaFlags.length ? ` (${m.ddmaFlags.join(", ")})` : ""} · ext A ${hex2(d.extA)} B ${hex2(d.extB)} · ` +
        `rect ${d.rowLength} x ${d.rowCount} · stride A ${d.strideA} B ${d.strideB} · transparent ${hex2(d.transparent)} · fill ${hex2(d.fill)}`
    );
  }
  for (const d of m.diagnostics) {
    const args = Object.entries(d.args)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    lines.push(`${d.severity}: ${d.id}${args ? ` (${args})` : ""}`);
  }
  return lines;
}
