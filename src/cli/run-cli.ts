import { KLIVE_APP_VERSION } from "@main/app-version";
import { EXIT_OK, EXIT_USAGE } from "./exit-codes";
import type { CliIo } from "./io";
import { runIde } from "./verbs/ide";

/*
 * The `klive` command line (`.plans/UNIT_TESTS_CLI_PLAN.md` D1–D3,
 * `.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D1): one executable, two families of verbs. `klive ide …`
 * drives a running Klive; the headless verbs (`test`, `build`, `run`) work on a machine of their own
 * in this process.
 */

export const CLI_HELP = `Usage: klive <verb> [<options>]

Verbs:
  ide <verb>       Drive a running Klive (build, run, debug, read memory, ...): 'klive ide help'
  help             This text
  --version        Klive's version

Exit codes: 0 ok, 1 failed, 2 build errors, 3 usage or configuration, 4 internal error, 5 timeout.`;

/** The headless verbs this build does not have yet, and what to use instead */
const NOT_YET: Record<string, string> = {
  build: "'klive build' (headless) is not available in this build yet. With Klive running, use 'klive ide build'.",
  run: "'klive run' (headless) is not available in this build yet. With Klive running, use 'klive ide run'.",
  test: "'klive test' is not available in this build yet. Run the tests from the IDE's Testing activity."
};

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
    default:
      io.err(NOT_YET[verb] ?? `Unknown verb '${verb}'. Run 'klive help' for the list.`);
      return EXIT_USAGE;
  }
}
