import path from "path";

import type { BuildResult } from "@common/automation/protocol";
import { parseArgs, parseNumberIn } from "../../args";
import { EXIT_BUILD_ERRORS, EXIT_FAILED, EXIT_OK, usageError } from "../../exit-codes";
import { gccDiagnostic } from "../../format";
import type { IdeVerb, IdeVerbContext } from "./context";

/*
 * `klive ide build|run|debug|inject|export` (D10, D12). The diagnostics print in the gcc format;
 * the exit code is 2 for a build with errors, 1 for any other failure.
 */

/** Prints a build result and returns its exit code */
function reportBuild(ctx: IdeVerbContext, result: BuildResult): number {
  const errorCount = result.errors.filter((e) => !e.warning).length;
  if (ctx.json) {
    ctx.printJson(result);
  } else {
    for (const diagnostic of result.errors) {
      (diagnostic.warning ? ctx.io.out : ctx.io.err)(gccDiagnostic(diagnostic));
    }
    if (result.message) (result.success ? ctx.io.out : ctx.io.err)(result.message);
  }
  if (errorCount > 0) return EXIT_BUILD_ERRORS;
  return result.success ? EXIT_OK : EXIT_FAILED;
}

function buildVerb(method: string): IdeVerb {
  return async (ctx) => {
    parseArgs(ctx.args, {});
    return reportBuild(ctx, await ctx.call<BuildResult>(method));
  };
}

export const buildProjectVerb = buildVerb("project.build");
export const runVerb = buildVerb("project.run");
export const debugProjectVerb = buildVerb("project.debug");
export const injectVerb = buildVerb("project.inject");

const EXPORT_USAGE =
  "Usage: klive ide export <file> [--format tap|tzx|hex|nex] [--name <name>] [--auto-start] " +
  "[--add-pause] [--add-clear] [--single-block] [--border <0-7>] [--address <addr>] [--screen <file>]";

export const exportVerb: IdeVerb = async (ctx) => {
  const { positional, options } = parseArgs(ctx.args, {
    flags: ["auto-start", "add-pause", "add-clear", "single-block"],
    values: ["format", "name", "border", "address", "screen"]
  });
  if (positional.length !== 1) throw usageError(EXPORT_USAGE);
  // --- Relative to where the command runs, as any CLI's output file is
  const file = path.resolve(ctx.io.cwd, positional[0]);
  const params: Record<string, unknown> = { file };
  if (options.format) params.format = options.format;
  if (options.name) params.name = options.name;
  if (options["auto-start"]) params.autoStart = true;
  if (options["add-pause"]) params.addPause = true;
  if (options["add-clear"]) params.addClear = true;
  if (options["single-block"]) params.singleBlock = true;
  if (options.border) params.border = parseNumberIn(options.border as string, "--border", 0, 7);
  if (options.address) params.address = parseNumberIn(options.address as string, "--address", 0x4000, 0xffff);
  if (options.screen) params.screenFile = path.resolve(ctx.io.cwd, options.screen as string);
  return reportBuild(ctx, await ctx.call<BuildResult>("project.export", params));
};
