import { KLIVE_APP_VERSION } from "@main/app-version";
import { EXIT_OK, EXIT_USAGE } from "./exit-codes";
import type { CliIo } from "./io";
import { runIde } from "./verbs/ide";
import { runBuildVerb } from "./verbs/build";
import { asCliError, runTestVerb } from "./verbs/test";

/*
 * The `klive` command line (`.plans/UNIT_TESTS_CLI_PLAN.md` D1–D3,
 * `.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D1): one executable, two families of verbs. `klive ide …`
 * drives a running Klive; the headless verbs (`test`, `build`, `run`) work on a machine of their own
 * in this process.
 */

export const CLI_HELP = `Usage: klive <verb> [<options>]

Verbs:
  test [<dir>]     Build the project and run its Z80 unit tests, headless: 'klive test --help'
  build [<dir>]    Compile the project's build root, headless: 'klive build --help'
  ide <verb>       Drive a running Klive (build, run, debug, read memory, ...): 'klive ide help'
  help             This text
  --version        Klive's version

Exit codes: 0 ok, 1 failed, 2 build errors, 3 usage or configuration, 4 internal error, 5 timeout.`;

/** The headless verbs this build does not have yet, and what to use instead */
const NOT_YET: Record<string, string> = {
  run: "'klive run' (headless) is not available in this build yet. With Klive running, use 'klive ide run'."
};

/** Runs a headless verb: a `CliError` is its message and exit code, anything else exit code 4 (D3) */
async function headless(verb: (argv: string[], io: CliIo) => Promise<number>, argv: string[], io: CliIo): Promise<number> {
  try {
    return await verb(argv, io);
  } catch (err) {
    const error = asCliError(err);
    io.err(error.message);
    return error.exitCode;
  }
}

/** Runs the CLI; returns the exit code */
export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const [verb, ...rest] = argv;
  switch (verb) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      io.out(CLI_HELP);
      return EXIT_OK;
    case "--version":
    case "version":
      io.out(KLIVE_APP_VERSION);
      return EXIT_OK;
    case "ide":
      return await runIde(rest, io);
    case "test":
      return await headless(runTestVerb, rest, io);
    case "build":
      return await headless(runBuildVerb, rest, io);
    default:
      io.err(NOT_YET[verb] ?? `Unknown verb '${verb}'. Run 'klive help' for the list.`);
      return EXIT_USAGE;
  }
}
