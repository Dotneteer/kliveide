import type { OutputSpecification } from "@renderer/appIde/ToolArea/abstractions";
import type { LogLine } from "./DebugSupport";

import { PANE_ID_LOG } from "@common/integration/constants";

/*
 * How logpoint lines look in the Log pane (`.plans/LOGPOINTS_PLAN.md` §4.3): `[GROUP] message`, the
 * group in the logpoint colour, then a dimmed `@ $8012` - where it fired. Colours are output-pane
 * colour names, which the pane maps to theme tokens; no literal here.
 */

/** Thousands grouped with spaces, the way the plan's drop line reads ("1 234"). */
function grouped(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** The output spans for a batch of log lines and the cap's drop count. */
export function logLineOutput(lines: LogLine[], dropped: number): OutputSpecification[] {
  const out: OutputSpecification[] = [];
  for (const line of lines) {
    out.push(
      { pane: PANE_ID_LOG, text: `[${line.group}] `, foreground: "bright-magenta", writeLine: false },
      { pane: PANE_ID_LOG, text: line.text, writeLine: false },
      {
        pane: PANE_ID_LOG,
        text: ` @ $${line.address.toString(16).toUpperCase().padStart(4, "0")}`,
        foreground: "bright-black",
        writeLine: true
      }
    );
  }
  if (dropped > 0) {
    out.push({
      pane: PANE_ID_LOG,
      text: `… ${grouped(dropped)} log line${dropped === 1 ? "" : "s"} dropped in this frame`,
      foreground: "yellow",
      writeLine: true
    });
  }
  return out;
}
