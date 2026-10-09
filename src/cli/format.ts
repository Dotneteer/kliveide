import type { BuildDiagnostic, WaitResult } from "@common/automation/protocol";

/*
 * Human-readable output of the `klive ide` verbs. Every verb also has `--json`.
 */

export function hex2(value: number): string {
  return `$${(value & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
}

export function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

/** "paused at $8103 (exec breakpoint)", "running" */
export function describeMachineState(result: WaitResult | { state: string; pc?: number }): string {
  let text = result.state;
  if (typeof result.pc === "number" && (result.state === "paused" || result.state === "stopped")) {
    text += ` at ${hex4(result.pc)}`;
  }
  const bp = (result as WaitResult).breakpoint;
  if (bp) {
    const where = bp.kind === "exec" ? "" : ` at ${hex4(bp.address)}`;
    text += ` (${bp.kind === "annotation" ? "comment" : bp.kind} breakpoint${where})`;
  }
  return text;
}

/** A diagnostic in the gcc format editors and CI annotators recognise (`UNIT_TESTS_CLI_PLAN.md` D5) */
export function gccDiagnostic(d: BuildDiagnostic): string {
  const code = d.code ? `${d.code}: ` : "";
  return `${d.file}:${d.line}:${d.column ?? 1}: ${d.warning ? "warning" : "error"}: ${code}${d.message}`;
}

/** A hex dump: 16 bytes a line, an address column and the printable characters */
export function hexDump(bytes: Uint8Array, start: number, label?: string): string[] {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const row = bytes.subarray(i, i + 16);
    const address = start + i;
    const where = label ? `${label}:${hex4(address)}` : hex4(address);
    const hex = Array.from(row, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
    const text = Array.from(row, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${where}  ${hex.padEnd(47)}  |${text}|`);
  }
  return lines;
}

/** The Z80 registers as the Z80 panel lays them out; other CPUs as name/value pairs */
export function formatRegisters(regs: Record<string, number | boolean>): string[] {
  const n = (name: string) => (typeof regs[name] === "number" ? (regs[name] as number) : 0);
  if (typeof regs.af === "number") {
    const f = n("af") & 0xff;
    const flags = [
      ["S", 0x80],
      ["Z", 0x40],
      ["5", 0x20],
      ["H", 0x10],
      ["3", 0x08],
      ["PV", 0x04],
      ["N", 0x02],
      ["C", 0x01]
    ]
      .map(([name, mask]) => ((f & (mask as number)) ? name : (name as string).toLowerCase()))
      .join(" ");
    const lines = [
      `AF  ${hex4(n("af"))}   BC  ${hex4(n("bc"))}   DE  ${hex4(n("de"))}   HL  ${hex4(n("hl"))}`,
      `AF' ${hex4(n("af_"))}   BC' ${hex4(n("bc_"))}   DE' ${hex4(n("de_"))}   HL' ${hex4(n("hl_"))}`,
      `IX  ${hex4(n("ix"))}   IY  ${hex4(n("iy"))}   SP  ${hex4(n("sp"))}   PC  ${hex4(n("pc"))}`,
      `I   ${hex2(n("i"))}     R   ${hex2(n("r"))}     WZ  ${hex4(n("wz"))}   IM  ${n("interruptMode")}`,
      `IFF1 ${regs.iff1 ? 1 : 0}  IFF2 ${regs.iff2 ? 1 : 0}  HALT ${regs.halted ? 1 : 0}   Flags ${flags}`
    ];
    if (typeof regs.tacts === "number") lines.push(`T-states ${regs.tacts}`);
    return lines;
  }
  return Object.entries(regs).map(([name, value]) =>
    typeof value === "number" ? `${name.padEnd(8)} ${hex4(value)} (${value})` : `${name.padEnd(8)} ${value}`
  );
}
