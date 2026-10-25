import type { BackendOptions } from "../options";

/** The label every way of running a program enters it at (its historical name is kept: D2). */
export const START_LABEL = "__kbasic_start";

/** The core package's routine that prints a report and ends the program: the NEX stub's error handler. */
const ERROR_HANDLER = "core.ReportError";

/** The `.model` of each target (the runtime pages the 48K BASIC ROM with `#ifmod` on it). */
export const MODEL_NAMES: Record<string, string> = { zx48k: "Spectrum48", zx128k: "Spectrum128", zxplus3: "SpectrumP3", next: "Next" };

/**
 * The origin and, for the Next, what the NEX needs: its header (`.savenex`) and a start stub. A NEX
 * is jumped to, not called, so the stub calls the program with interrupts on (PAUSE needs them) and
 * ERR_SP at a slot holding the core runtime's `ReportError` (a report, the ROM's own included, prints
 * and ends the program: NextZXOS's 48K ROM has no original main loop to go back to), then waits;
 * `__kbasic_start`, after it, stays the entry every other way of running the program uses.
 */
export function nexHeader(options: BackendOptions, programName: string): string[] {
  const org = `    .org ${options.origin}`;
  if (options.target !== "next") return [org];
  return [
    // --- The NEX is named after the program (export and `debug` write it; its debug sidecar goes beside it)
    `    .savenex file "${programName.replace(/"/g, "")}.nex"`,
    `    .savenex core "${options.nex.core}"`,
    ...(options.nex.stack !== undefined ? [`    .savenex stackaddr ${options.nex.stack}`] : []),
    org,
    "__kbNexStart:",
    "    ei",
    `    ld hl,${ERROR_HANDLER}`,
    "    push hl",
    "    ld ($5c3d),sp",
    `    call ${START_LABEL}`,
    "__kbNexEnd:",
    "    jr __kbNexEnd",
    `    .savenex entryaddr ${options.nex.entry ?? "__kbNexStart"}`
  ];
}
