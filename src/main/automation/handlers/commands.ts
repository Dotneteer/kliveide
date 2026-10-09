import type { CapturedCommandResult } from "@common/messaging/IdeApi";
import type { BuildDiagnostic, CommandRunResult } from "@common/automation/protocol";
import { automationError } from "../errors";
import type { MethodContext } from "../method-types";

/*
 * Running IDE commands for the methods built on them (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md`
 * D9, D10): the command runs into a fresh buffer that is mirrored to the Build pane, so the user
 * still sees what a script did, and its output comes back as plain text lines.
 */

/** Runs a command; a denied one (T5) is an error, any other result is returned */
export async function runIdeCommand(ctx: MethodContext, text: string): Promise<CapturedCommandResult> {
  const result = await ctx.host.ide.executeCommandCaptured(text, { automation: true });
  if (result?.denied) {
    throw automationError(
      "command-denied",
      result.finalMessage ?? `'${text.split(/\s+/)[0]}' cannot be run through automation.`
    );
  }
  return result ?? { success: false, output: [] };
}

/** A command's result in the protocol's shape */
export function commandRunResult(result: CapturedCommandResult): CommandRunResult {
  return {
    success: !!result.success,
    ...(result.finalMessage ? { message: result.finalMessage.replace(/^\$W:/, "") } : {}),
    ...(result.value !== undefined ? { value: result.value } : {}),
    output: result.output ?? []
  };
}

/** Runs a command that must succeed: a failure is a `command-failed` error carrying its output */
export async function runIdeCommandOrFail(ctx: MethodContext, text: string): Promise<CommandRunResult> {
  const result = commandRunResult(await runIdeCommand(ctx, text));
  if (!result.success) {
    throw automationError("command-failed", result.message ?? `'${text}' failed.`, {
      output: result.output,
      ...(result.value !== undefined ? { value: result.value } : {})
    });
  }
  return result;
}

/** The structured diagnostics a build command returns in its `value` (D10) */
export function diagnosticsOf(value: unknown): BuildDiagnostic[] {
  const errors = (value as { errors?: unknown })?.errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .filter((e) => e && typeof e === "object")
    .map((e: any) => ({
      file: String(e.file ?? ""),
      line: Number(e.line ?? 0),
      ...(e.column !== undefined ? { column: Number(e.column) } : {}),
      ...(e.code ? { code: String(e.code) } : {}),
      message: String(e.message ?? ""),
      ...(e.warning ? { warning: true } : {})
    }));
}

/** Quotes a command argument for the IDE's command tokenizer */
export function quoteCommandArg(text: string): string {
  return `"${text.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}
