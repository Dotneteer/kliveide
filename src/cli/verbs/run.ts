import { KLIVE_APP_VERSION } from "@main/app-version";
import { writeKliveStateFile } from "@common/machineState/kliveStateFile";
import type { SpectrumSnapshot, SpectrumSnapshotFormat } from "@common/spectrum/snapshot/spectrumSnapshot";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import { encodePng } from "@common/imaging/png";
import { runFrames, type FrameMachine } from "@common/headless/frameRunner";
import { typeText, type SpectrumKeyboardMachine } from "@common/headless/keyboard";
import { attachRunBreakpoints, runToStop, type RunStop, type StopConditions, type StopMachine } from "@common/headless/runToStop";
import { screenImageOf } from "@common/headless/screenImage";
import { captureKliveStateFile } from "@renderer/appEmu/machines/machineStateFile";
import { parseArgs, parseNumber } from "../args";
import { EXIT_OK, EXIT_TIMEOUT, usageError } from "../exit-codes";
import { formatRegisters, hex4 } from "../format";
import type { CliIo } from "../io";
import { BP_SYNTAX, parseBreakpointOption, resolveAddress } from "../run/breakpoints";
import { loadRunInput, type LoadedInput } from "../run/inputs";

/*
 * `klive run` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D15): start a project's build or a file on a
 * machine of its own, headless, run it until a stop condition, then write what the run asked for -
 * memory, registers, the picture, a state file. Everything is emulated time, so identical inputs give
 * byte-identical outputs (T10).
 */

export const RUN_HELP = `Usage: klive run [<project-dir> | <file>] [<options>]

Starts a project's build (as the IDE's run injects it) or a file (.tap, .tzx, .sna, .z80, .szx,
.kls, .nex, .p, .81, .o, .80) on a machine of its own, without the IDE, and runs it until it stops.

When to stop (at least one; frames and T-states count from after --keys):
  --frames <n>              After n frames
  --tstates <n>             At the first instruction boundary at or after n T-states
  --until-pc <addr>[,...]   When PC reaches an address or a label of the build (repeatable)
  --until-halt              At a HALT with interrupts disabled
  --bp "<spec>"             At a breakpoint, in bp-set syntax (repeatable):
                            ${BP_SYNTAX}
  --timeout <s>             After s emulated seconds: exit code 5 (default 60 with only
                            --until-pc, --until-halt or --bp)

Input:
  --machine <id>[:<model>]  The machine (sp48, sp128, spp3e, zxnext, zx80, zx81); a project's
                            or the file's own by default
  --wait-frames <n>         Frames to run before typing (default 0)
  --keys "<text>"           Type at the keyboard: letters, digits, space, \\n for ENTER, symbols
                            (Symbol Shift), {CS+5}-style chords of named keys
  --rom <name>=<file>       A ROM file in place of the one Klive ships (sp48, sp128-0, ...)
  --sjasmplus <path>        The sjasmplus executable, for a project that uses it
  --use-ide-settings        Read the IDE's user settings too

After the stop:
  --dump-mem <addr>[:<len>]=<file>  Write memory as the CPU sees it (len: to $FFFF); repeatable
  --dump-regs <file.json>   Write the registers as JSON ('-' prints them)
  --screenshot <file.png>   Write the picture
  --save-state <file>       Write a Klive state file (.kls), or a .sna, .z80 or .szx snapshot of a
                            ZX Spectrum
  --no-timestamp            Leave the save time out of the state file (byte-identical runs)
  --json                    Print the result as JSON

Exit codes: 0 stopped as asked, 2 build errors, 3 usage or input, 4 internal error,
5 --timeout ran out first.`;

const SPEC = {
  flags: ["until-halt", "no-timestamp", "use-ide-settings", "json", "help"],
  values: ["machine", "frames", "tstates", "timeout", "keys", "wait-frames", "dump-regs", "screenshot", "save-state", "sjasmplus"],
  repeatable: ["until-pc", "bp", "dump-mem", "rom"]
};

/** The default budget, in emulated seconds, of a run that only stops at an address or a breakpoint */
export const DEFAULT_RUN_TIMEOUT_S = 60;

/** A whole number option */
function count(text: string, what: string): number {
  const value = parseNumber(text);
  if (value === undefined || value < 0 || !Number.isSafeInteger(value)) {
    throw usageError(`${what} must be a whole number: '${text}'.`);
  }
  return value;
}

/** `--dump-mem $C000:256=state.bin` */
export function parseDumpOption(text: string): { address: string; length?: string; file: string } {
  const eq = text.indexOf("=");
  if (eq <= 0 || eq === text.length - 1) throw usageError(`--dump-mem takes <addr>[:<len>]=<file>: '${text}'.`);
  const where = text.slice(0, eq).trim();
  const file = text.slice(eq + 1).trim();
  const colon = where.indexOf(":");
  return colon < 0 ? { address: where, file } : { address: where.slice(0, colon).trim(), length: where.slice(colon + 1).trim(), file };
}

/** The registers as `cpu.get` names them */
export function registersOf(machine: Record<string, any>): Record<string, number | boolean> {
  const names = ["af", "bc", "de", "hl", "af_", "bc_", "de_", "hl_", "ix", "iy", "sp", "pc", "i", "r", "wz", "interruptMode"];
  const regs: Record<string, number | boolean> = {};
  for (const name of names) regs[name] = Number(machine[name] ?? 0);
  regs.iff1 = !!machine.iff1;
  regs.iff2 = !!machine.iff2;
  regs.halted = !!machine.halted;
  regs.tacts = Number(machine.tacts ?? 0);
  return regs;
}

/** Runs `klive run`; returns the exit code */
export async function runRunVerb(argv: string[], io: CliIo): Promise<number> {
  const { positional, options } = parseArgs(argv, SPEC);
  if (options.help) {
    io.out(RUN_HELP);
    return EXIT_OK;
  }
  if (positional.length > 1) throw usageError(`klive run takes one project folder or file: ${positional.join(" ")}`);

  // --- Options checked before anything is built
  const frames = options.frames !== undefined ? count(options.frames as string, "--frames") : undefined;
  const tstates = options.tstates !== undefined ? count(options.tstates as string, "--tstates") : undefined;
  const waitFrames = options["wait-frames"] !== undefined ? count(options["wait-frames"] as string, "--wait-frames") : 0;
  let timeoutSeconds: number | undefined;
  if (options.timeout !== undefined) {
    timeoutSeconds = Number(options.timeout);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      throw usageError(`--timeout must be a positive number of emulated seconds: '${options.timeout}'.`);
    }
  }
  const untilPcText = ((options["until-pc"] as string[] | undefined) ?? []).flatMap((t) => t.split(",").map((s) => s.trim()).filter(Boolean));
  const bpText = (options.bp as string[] | undefined) ?? [];
  const untilHalt = !!options["until-halt"];
  if (frames === undefined && tstates === undefined && timeoutSeconds === undefined && !untilPcText.length && !untilHalt && !bpText.length) {
    throw usageError("Say when the run stops: --frames, --tstates, --until-pc, --until-halt, --bp or --timeout.");
  }
  const dumps = ((options["dump-mem"] as string[] | undefined) ?? []).map(parseDumpOption);

  // --- 1. The machine, at the program's start
  const input = await loadRunInput(
    positional[0] ?? ".",
    {
      machine: options.machine as string | undefined,
      roms: options.rom as string[] | undefined,
      sjasmplus: options.sjasmplus as string | undefined,
      useIdeSettings: !!options["use-ide-settings"]
    },
    io
  );
  for (const note of input.notes) io.err(`Note: ${note}`);
  const machine = input.machine as unknown as StopMachine & SpectrumKeyboardMachine & Record<string, any>;

  // --- Addresses and breakpoints resolve against the build's labels
  const untilPc = untilPcText.map((t) => resolveAddress(t, input.symbols, "--until-pc"));
  const breakpoints = bpText.map((t) => parseBreakpointOption(t, input.symbols));
  const dumpRanges = dumps.map((d) => {
    const address = resolveAddress(d.address, input.symbols, "The --dump-mem address");
    const length = d.length === undefined ? 0x10000 - address : count(d.length, "The --dump-mem length");
    if (length < 1 || address + length > 0x10000) throw usageError(`--dump-mem ${d.address}:${d.length} goes past $FFFF.`);
    return { address, length, file: d.file };
  });

  // --- 2. Keys
  if (waitFrames) runFrames(machine as FrameMachine, waitFrames);
  if (options.keys !== undefined) {
    try {
      typeText(machine, unescapeKeys(options.keys as string));
    } catch (err) {
      throw usageError(`--keys: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- 3. Run
  const ds = attachRunBreakpoints(machine, breakpoints, untilPc, input.symbols);
  const problems = (ds?.listBreakpointsWithState() ?? [])
    .filter((bp) => bp.owner?.kind !== "session")
    .flatMap((bp) => [bp.conditionError, bp.logError, bp.conditionInactive].filter(Boolean).map((p) => `${hex4(bp.address ?? 0)}: ${p}`));
  if (problems.length) throw usageError(`--bp: ${problems.join("; ")}`);
  const clock = Number(machine.baseClockFrequency) * (Number(machine.clockMultiplier) || 1);
  const onlyOpenEnded = frames === undefined && tstates === undefined && timeoutSeconds === undefined;
  const budgetSeconds = timeoutSeconds ?? (onlyOpenEnded ? DEFAULT_RUN_TIMEOUT_S : undefined);
  const conditions: StopConditions = {
    ...(frames !== undefined ? { frames } : {}),
    ...(tstates !== undefined ? { tstates } : {}),
    ...(untilPc.length ? { untilPc } : {}),
    ...(untilHalt ? { untilHalt } : {}),
    ...(budgetSeconds !== undefined ? { timeoutTstates: Math.max(1, Math.round(budgetSeconds * clock)) } : {})
  };
  const stop = runToStop(machine, conditions, { onLog: (line) => io.out(`log: ${line}`) });

  // --- 4. Outputs
  const written: string[] = [];
  for (const d of dumpRanges) {
    const bytes = new Uint8Array(d.length);
    for (let i = 0; i < d.length; i++) bytes[i] = machine.doReadMemory((d.address + i) & 0xffff) & 0xff;
    written.push(io.writeFile(d.file, bytes));
  }
  const regs = registersOf(machine);
  if (options["dump-regs"] !== undefined) {
    const file = options["dump-regs"] as string;
    if (file === "-") {
      formatRegisters(regs).forEach((line) => io.out(line));
    } else {
      written.push(io.writeFile(file, JSON.stringify(regs, null, 2) + "\n"));
    }
  }
  if (options.screenshot !== undefined) {
    const image = screenImageOf(machine as never);
    written.push(io.writeFile(options.screenshot as string, new Uint8Array(encodePng(image.pixels, image.width, image.height))));
  }
  if (options["save-state"] !== undefined) {
    const file = options["save-state"] as string;
    written.push(io.writeFile(file, saveState(input, file, !!options["no-timestamp"])));
  }

  // --- 5. Report
  if (options.json) {
    io.out(
      JSON.stringify({
        input: input.description,
        machine: input.machineId,
        ...(input.modelId ? { model: input.modelId } : {}),
        stop: stop.reason,
        pc: stop.pc,
        frames: stop.frames,
        tstates: stop.tstates,
        ...(stop.breakpoints.length ? { breakpoints: stop.breakpoints.map((bp) => bp.address) } : {}),
        registers: regs,
        files: written
      })
    );
  } else {
    io.out(`${input.description}: ${describeStop(stop)}`);
    for (const file of written) io.err(`Wrote ${file}`);
  }
  return stop.reason === "timeout" ? EXIT_TIMEOUT : EXIT_OK;
}

/** "stopped at $8103 (breakpoint) after 50 frames, 3,494,400 T-states" */
export function describeStop(stop: RunStop): string {
  const why: Record<RunStop["reason"], string> = {
    frames: "frame count reached",
    tstates: "T-state count reached",
    pc: "address reached",
    halt: "halted with interrupts disabled",
    breakpoint: "breakpoint",
    timeout: "timed out"
  };
  return `stopped at ${hex4(stop.pc)} (${why[stop.reason]}) after ${stop.frames} frame${stop.frames === 1 ? "" : "s"}, ${stop.tstates.toLocaleString("en-US")} T-states`;
}

/** `\n` in a shell argument means ENTER */
function unescapeKeys(text: string): string {
  return text.replace(/\\n/g, "\n");
}

/**
 * The machine as a Klive state file, or a Spectrum snapshot when the file name asks for one
 * @throws CliError (exit code 3) when the machine or the format cannot hold the state
 */
function saveState(input: LoadedInput, file: string, noTimestamp: boolean): Uint8Array {
  const format = /\.(sna|z80|szx)$/i.exec(file)?.[1].toLowerCase() as SpectrumSnapshotFormat | undefined;
  if (format) {
    const machine = input.machine as { captureSnapshotState?: () => SpectrumSnapshot };
    if (!machine.captureSnapshotState) throw usageError(`--save-state: the ${input.machineId} has no .${format} snapshots; use a .kls file.`);
    try {
      const [major, minor] = KLIVE_APP_VERSION.split(".").map((p) => parseInt(p, 10) || 0);
      return writeSpectrumSnapshot(machine.captureSnapshotState(), format, { name: "Klive IDE", major, minor }).bytes;
    } catch (err) {
      throw usageError(`--save-state: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!/\.kls$/i.test(file)) throw usageError(`--save-state writes a .kls, .sna, .z80 or .szx file: '${file}'.`);
  const ports = {
    getEmulatorState: () => ({ machineId: input.machineId, modelId: input.modelId, config: input.config }),
    getMediaFiles: () => ({})
  };
  const state = captureKliveStateFile(ports as never, input.machine as never, { kliveVersion: KLIVE_APP_VERSION }).file;
  if (noTimestamp) state.header.savedAt = new Date(0).toISOString();
  return writeKliveStateFile(state);
}
