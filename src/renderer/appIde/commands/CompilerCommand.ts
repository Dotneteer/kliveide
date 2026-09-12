import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { IdeCommandBase, commandError, commandSuccessWith } from "../services/ide-commands";
import { setProjectDebuggingAction } from "@common/state/actions";
import { compileCode } from "@renderer/appIde/utils/compile-code";
/*
 * `injectCode` is shared with the `klive.*` commands and lives in their module, because the NEX
 * export step it performs for ZX Next builds calls `ExportCodeCommand`, which is defined there.
 * See the note on the function itself.
 */
import { injectCode } from "./KliveCompilerCommands";

export class CompileCommand extends IdeCommandBase {
  readonly id = "compile";
  readonly description = "Compiles the current project";
  readonly usage = "compile";
  readonly aliases = ["co"];
  readonly requiresProject = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const compileResult = await compileCode(context);
    return compileResult.message
      ? commandError(compileResult.message)
      : commandSuccessWith(`Project file successfully compiled.`);
  }
}

export class InjectCodeCommand extends IdeCommandBase {
  readonly id = "inject";
  readonly description = "Injects the current projec code into the machine";
  readonly usage = "inject";
  readonly aliases = ["inj"];
  readonly requiresProject = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "inject");
  }
}

export class RunCodeCommand extends IdeCommandBase {
  readonly id = "run";
  readonly description = "Runs the current project's code in the virtual machine";
  readonly usage = "run";
  readonly aliases = ["r"];
  readonly requiresProject = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.store.dispatch(setProjectDebuggingAction(false), "ide");
    return await injectCode(context, "run");
  }
}

export class DebugCodeCommand extends IdeCommandBase {
  readonly id = "debug";
  readonly description = "Runs the current project's code in the virtual machine with debugging";
  readonly usage = "debug";
  readonly aliases = ["rd"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.store.dispatch(setProjectDebuggingAction(true), "ide");
    return await injectCode(context, "debug");
  }
}
