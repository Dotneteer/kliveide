import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

/*
 * The text of a stop a DeZog `ASSERTION` or `WPMEM` comment caused
 * (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` S11). Shared by the emulator's machine controller
 * and the headless unit-test runner (`.plans/Z80_UNIT_TESTS_PLAN.md` D8), so a failing test says
 * exactly what the debugger says when the same assertion stops it. No renderer imports.
 */

/** What the report reads from the breakpoint store */
export type CommentStopSource = {
  /** The definitions that stopped the machine (`DebugSupport.lastStopBreakpoints`) */
  lastStopBreakpoints?: BreakpointInfo[];
  /** Where each of them fired */
  lastStopAccesses?: { address: number; value?: number }[];
  /** The build's integer symbols, keyed lower-case */
  conditionSymbolTable?: Record<string, number>;
  /** `A=$07, b@(HL)=$12` for an ASSERTION's expression */
  describeDezogValues(text: string): string;
};

/** One line of a comment stop's report, with the place it names */
export type CommentStopLine = {
  kind: "ASSERTION" | "WPMEM";
  /** The report line */
  text: string;
  /** The resource and line the report names: the macro invocation for a comment in a macro (T2) */
  resource?: string;
  line?: number;
  /** The breakpoint that fired */
  breakpoint: BreakpointInfo;
};

/**
 * The lines of a comment stop's report, or an empty list for any other stop:
 *
 * - `ASSERTION failed at main.asm:42: A < 5  (A=$07)`
 * - `WPMEM write at $8002 (fill_colors+2) by PC $8123, main.asm:40`
 *
 * @param source The breakpoint store
 * @param accessPc The PC of the instruction that made a WPMEM access
 */
export function commentStopLines(source: CommentStopSource, accessPc: () => number): CommentStopLine[] {
  const fired = source.lastStopBreakpoints ?? [];
  const lines: CommentStopLine[] = [];
  fired.forEach((bp, i) => {
    if (bp.owner?.kind !== "annotation" || !bp.annotationKind) return;
    const site = bp.annotationInvokedAt ?? { resource: bp.resource ?? "", line: bp.line ?? 0 };
    const where = `${(site.resource ?? "").split(/[\\/]/).pop()}:${site.line}`;
    if (bp.annotationKind === "ASSERTION") {
      const text = bp.annotationText ?? "";
      const values = text ? source.describeDezogValues(text) : "";
      lines.push({
        kind: "ASSERTION",
        text: `ASSERTION failed at ${where}: ${text || "(always)"}${values ? `  (${values})` : ""}`,
        resource: site.resource,
        line: site.line,
        breakpoint: bp
      });
    } else if (bp.annotationKind === "WPMEM") {
      const access = source.lastStopAccesses?.[i];
      const address = access?.address ?? bp.address ?? 0;
      const named = nearestSymbol(source.conditionSymbolTable, address);
      lines.push({
        kind: "WPMEM",
        text:
          `WPMEM ${bp.memoryRead ? "read" : "write"} at $${hex4(address)}` +
          `${named ? ` (${named})` : ""} by PC $${hex4(accessPc())}, ${where}`,
        resource: site.resource,
        line: site.line,
        breakpoint: bp
      });
    }
  });
  return lines;
}

/**
 * `fill_colors+2`: the closest build symbol at or below an address, within 256 bytes, or
 * `undefined`. Symbols are keyed lower-case, so the name comes back lower-case.
 */
export function nearestSymbol(symbols: Record<string, number> | undefined, address: number): string | undefined {
  let best: { name: string; value: number } | undefined;
  for (const [name, value] of Object.entries(symbols ?? {})) {
    if (name.includes(":") || value > address || address - value > 0xff) continue;
    if (!best || value > best.value || (value === best.value && name < best.name)) {
      best = { name, value };
    }
  }
  if (!best) return undefined;
  return address === best.value ? best.name : `${best.name}+${address - best.value}`;
}

function hex4(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
