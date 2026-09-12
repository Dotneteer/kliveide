import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import {
  endCompileAction,
  incBreakpointsVersionAction,
  startCompileAction
} from "@common/state/actions";
import { refreshSourceCodeBreakpoints } from "@common/utils/breakpoints";
import { outputNavigateAction, writeErrorMessageWithLinks } from "@common/utils/output-utils";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/**
 * Compiling the project's build root, and reporting what went wrong.
 *
 * ## Why this is its own module
 *
 * There were two of these — `CompilerCommand.ts` and `KliveCompilerCommands.ts` each carried a
 * private `compileCode`, reached by `compile` and `klive.compile` respectively, the latter being
 * what the toolbar's Build button runs through `build.ksx`. They had drifted by two lines, and
 * both differences were one copy having been fixed and the other not:
 *
 *   - `result?.errors?.filter` versus `result?.errors.filter`, the second of which throws when a
 *     compiler returns a result with no `errors` array;
 *   - the `releaseLocks()` call below.
 *
 * The drift is also how `out.severity()` came to be added to one and not the other, which is
 * invisible until someone runs the command that uses the copy without it. One function now, so a
 * change reaches every command that compiles.
 *
 * `injectCode` is *not* here, deliberately. The two copies of that one have genuinely diverged —
 * the Klive version exports a NEX file for ZX Spectrum Next builds and locks the compiled source
 * list — so merging them is a design decision about what injection means, not de-duplication.
 */

export function modelTypeToMachineType(model: SpectrumModelType): string | null {
  switch (model) {
    case SpectrumModelType.Spectrum48:
      return "sp48";
    case SpectrumModelType.Spectrum128:
      return "sp128";
    case SpectrumModelType.SpectrumP3:
      return "spp3e";
    case SpectrumModelType.Next:
      return "next";
    default:
      return null;
  }
}

/**
 * Compiles the current project's build root.
 *
 * Writes diagnostics to `context.output` — marked with `severity()` so a panel can tell an error
 * from a line that merely happens to be red — and returns the compiler output plus a summary
 * message when the build failed.
 */
export async function compileCode(
  context: IdeCommandContext
): Promise<{ result?: KliveCompilerOutput; message?: string }> {
  /*
   * Release the files the debugger locked.
   *
   * Only `injectCode` ever calls `setLockedFiles`, and only to lock the source list of the last
   * successful compile so `DocumentAreaPane` can badge those tabs. Releasing them here — before
   * any compile, not just the one the Klive commands used to run — is what the two copies of this
   * function disagreed about, and it means a plain `compile` after an inject no longer leaves the
   * previous build's tabs locked.
   */
  context.service.projectService.releaseLocks();

  // --- Shortcuts
  const out = context.output;

  // --- Check if we have a build root to compile
  const state = context.store.getState();
  if (!state.project?.isKliveProject) {
    return { message: "No Klive project loaded." };
  }
  const buildRoot = state.project.buildRoots?.[0];
  if (!buildRoot) {
    return { message: "No build root selected in the current Klive project." };
  }
  const fullPath = `${state.project.folderPath}/${buildRoot}`;
  const language = getFileTypeEntry(fullPath, context.store)?.subType;

  // --- Compile the build root
  out.color("bright-blue");
  out.write("Start compiling ");
  outputNavigateAction(context.output, buildRoot);
  out.writeLine();
  out.resetStyle();

  context.store.dispatch(startCompileAction(fullPath));
  let result: KliveCompilerOutput;
  let failedMessage = "";
  try {
    result = await context.mainApi.compileFile(fullPath, language);
  } catch (err) {
    failedMessage = err.message;
  } finally {
    context.store.dispatch(endCompileAction(result));
    await refreshSourceCodeBreakpoints(context.store, context.messenger);
    context.store.dispatch(incBreakpointsVersionAction());
  }

  // --- Display optional trace output
  const traceOutput = result?.traceOutput;
  if (traceOutput?.length > 0) {
    out.resetStyle();
    traceOutput.forEach((msg) => out.writeLine(msg));
  }

  // --- Display optional debug messages (e.g., DISPLAY directives from SjasmPlus)
  const debugMessages = (result as any)?.debugMessages;
  if (debugMessages?.length > 0) {
    out.resetStyle();
    out.color("bright-cyan");
    debugMessages.forEach((msg: string) => {
      out.writeLine(msg);
    });
    out.resetStyle();
  }

  // --- Collect errors
  const errorCount = result?.errors?.filter((m) => !m.isWarning).length ?? 0;

  if (failedMessage) {
    if (!result || errorCount === 0) {
      // --- Some unexpected error with the compilation
      return { message: failedMessage };
    }
  }

  // --- Display the errors
  if ((result.errors?.length ?? 0) > 0) {
    for (let i = 0; i < result.errors.length; i++) {
      const err = result.errors[i];
      // --- The colour says how it looks; this says what it is. A panel can count, mark or filter
      // --- on the second and not on the first.
      out.severity(err.isWarning ? "warning" : "error");
      out.color(err.isWarning ? "yellow" : "bright-red");
      out.bold(true);
      out.write(`${err.errorCode}: `);
      writeErrorMessageWithLinks(
        context.output,
        err.message,
        err.isWarning ? "yellow" : "bright-red"
      );
      out.write(" - ");
      out.bold(false);
      out.color("bright-cyan");
      outputNavigateAction(context.output, err.filename, err.line, err.startColumn);
      out.writeLine();
      out.resetStyle();
    }
  }

  // --- Done.
  return errorCount > 0
    ? {
        result,
        message: `Compilation failed with ${errorCount} error${errorCount > 1 ? "s" : ""}.`
      }
    : { result };
}
