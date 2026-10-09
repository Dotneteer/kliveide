import { parseArgs } from "../args";
import { compileProject } from "../compile";
import { EXIT_BUILD_ERRORS, EXIT_OK, usageError } from "../exit-codes";
import { gccDiagnostic } from "../format";
import type { CliIo } from "../io";
import { loadProject } from "../project";
import { parseMachineOption } from "./test";

/*
 * `klive build` (`.plans/UNIT_TESTS_CLI_PLAN.md` D2, Q3): compile the build root, for CI jobs that
 * only assemble. Errors go to stderr in the gcc format; `--out` writes the code.
 */

export const BUILD_HELP = `Usage: klive build [<project-dir>] [<options>]

Compiles the project's build root without the IDE.

Options:
  --out <file>              Write the code: Intel HEX for a .hex file, else a flat binary
                            from the lowest to the highest address (unbanked code only)
  --machine <id>[:<model>]  The machine the build is for (the sjasmplus device follows it)
  --sjasmplus <path>        The sjasmplus executable (else SJASMPLUS, the project, the PATH)
  --use-ide-settings        Read the IDE's user settings too

Exit codes: 0 built, 2 build errors, 3 usage or configuration, 4 internal error.`;

type Segment = { startAddress: number; emittedCode: number[]; bank?: number };

/** Runs `klive build`; returns the exit code */
export async function runBuildVerb(argv: string[], io: CliIo): Promise<number> {
  const { positional, options } = parseArgs(argv, {
    flags: ["use-ide-settings", "help"],
    values: ["out", "machine", "sjasmplus"]
  });
  if (options.help) {
    io.out(BUILD_HELP);
    return EXIT_OK;
  }
  if (positional.length > 1) throw usageError(`klive build takes one project folder: ${positional.join(" ")}`);
  const project = loadProject(positional[0] ?? ".", io.cwd);
  const machine = options.machine ? parseMachineOption(options.machine as string) : {};
  const build = await compileProject(
    project,
    {
      sjasmplus: options.sjasmplus as string | undefined,
      useIdeSettings: !!options["use-ide-settings"],
      ...machine
    },
    io.env,
    io.cwd
  );
  for (const d of build.diagnostics) io.err(gccDiagnostic(d));
  const errors = build.diagnostics.filter((d) => !d.warning).length;
  if (build.failed) {
    io.err(`Build failed: ${errors} error${errors === 1 ? "" : "s"}.`);
    return EXIT_BUILD_ERRORS;
  }
  const segments = ((build.output as { segments?: Segment[] }).segments ?? []).filter((s) => s.emittedCode?.length);
  const bytes = segments.reduce((n, s) => n + s.emittedCode.length, 0);
  io.out(`Built ${project.buildRoot}: ${segments.length} segment${segments.length === 1 ? "" : "s"}, ${bytes} byte${bytes === 1 ? "" : "s"}.`);
  if (options.out) {
    const file = options.out as string;
    const data = /\.hex$/i.test(file) ? toIntelHex(segments) : toFlatBinary(segments);
    io.out(`Wrote ${io.writeFile(file, data)}`);
  }
  return EXIT_OK;
}

/** The unbanked segments as one image from the lowest to the highest address; gaps are zero */
export function toFlatBinary(segments: readonly Segment[]): Uint8Array {
  if (segments.some((s) => s.bank !== undefined)) {
    throw usageError("The build has banked code, which a flat binary cannot hold; export it from the IDE (expc) instead.");
  }
  if (!segments.length) return new Uint8Array(0);
  const start = Math.min(...segments.map((s) => s.startAddress));
  const end = Math.max(...segments.map((s) => s.startAddress + s.emittedCode.length));
  const image = new Uint8Array(end - start);
  for (const s of segments) image.set(s.emittedCode, s.startAddress - start);
  return image;
}

/** Intel HEX of the unbanked segments: 16-byte data records and the end record */
export function toIntelHex(segments: readonly Segment[]): string {
  if (segments.some((s) => s.bank !== undefined)) {
    throw usageError("The build has banked code, which Intel HEX cannot hold; export it from the IDE (expc) instead.");
  }
  const hex = (v: number, digits: number) => v.toString(16).toUpperCase().padStart(digits, "0");
  const record = (address: number, type: number, data: number[]) => {
    let sum = data.length + ((address >> 8) & 0xff) + (address & 0xff) + type;
    for (const b of data) sum += b;
    return `:${hex(data.length, 2)}${hex(address & 0xffff, 4)}${hex(type, 2)}${data.map((b) => hex(b, 2)).join("")}${hex((-sum) & 0xff, 2)}`;
  };
  const lines: string[] = [];
  for (const s of segments) {
    for (let i = 0; i < s.emittedCode.length; i += 16) {
      lines.push(record(s.startAddress + i, 0, s.emittedCode.slice(i, i + 16)));
    }
  }
  lines.push(record(0, 1, []));
  return lines.join("\n") + "\n";
}
