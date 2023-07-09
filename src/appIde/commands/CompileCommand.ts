import { MainCompileResponse } from "@common/messaging/any-to-main";
import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import { getFileTypeEntry } from "../project/project-node";
import {
  commandError,
  commandSuccessWith
} from "../services/ide-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class CompileCommand extends CommandWithNoArgBase {
  readonly id = "compile";
  readonly description = "Compiles the current project";
  readonly usage = "compile";
  readonly aliases = ["co"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Shortcuts
    const out = context.output;
    const ideCmd = context.service.ideCommandsService;

    // --- Check if we have a build root to compile
    const state = context.store.getState();
    if (!state.project?.isKliveProject) {
      return commandError("No Klive project loaded.");
    }
    const buildRoot = state.project.buildRoots?.[0];
    if (!buildRoot) {
      return commandError(
        "No build root selected in the current Klive project."
      );
    }
    const fullPath = `${state.project.folderPath}/${buildRoot}`;
    const language = getFileTypeEntry(fullPath)?.subType;

    // --- Compile the build root
    out.color("bright-blue");
    out.write("Start compiling ");
    ideCmd.writeNavigationAction(context, buildRoot);
    out.writeLine();
    out.resetStyle();

    const response = await context.messenger.sendMessage<MainCompileResponse>({
      type: "MainCompileFile",
      filename: fullPath,
      language
    });

    // --- Collect errors
    const result = response.result;
    const errors = result?.errors;

    if (response.failed) {
      if (!result || (errors?.length ?? 0) === 0) {
        // --- Some unexpected error with the compilation
        return commandError(response.failed);
      }
    }

    // --- Display the errors
    if ((errors?.length ?? 0) > 0) {
      for (let i = 0; i < response.result.errors.length; i++) {
        const err = response.result.errors[i];
        out.color("bright-red");
        out.bold(true);
        out.write(`Error ${err.errorCode}: ${err.message}`);
        out.write(" - ");
        out.bold(false);
        out.color("bright-cyan");
        ideCmd.writeNavigationAction(context, err.fileName, err.line, err.startColumn)
        out.writeLine();
        out.resetStyle();
      }
      return commandError(
        `Compilation failed with ${errors.length} error${
          errors.length > 1 ? "s" : ""
        }.`
      );
    }

    // --- Compilation ok.
    return commandSuccessWith(
      `Project file successfully compiled.`
    );
  }
}
