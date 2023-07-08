import { MainCompileResponse } from "@common/messaging/any-to-main";
import { InteractiveCommandContext } from "../abstractions/InteractiveCommandContext";
import { InteractiveCommandResult } from "../abstractions/InteractiveCommandResult";
import { getFileTypeEntry } from "../project/project-node";
import {
  writeMessage,
  commandSuccess,
  commandError
} from "../services/interactive-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class CompileCommand extends CommandWithNoArgBase {
  readonly id = "compile";
  readonly description = "Compiles the current project";
  readonly usage = "compile";
  readonly aliases = ["co"];

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
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
        context.output.backgroundColor("bright-red");
        context.output.writeLine(err.message);
        context.output.resetColor();
      }
      return commandError("Compilation failed.");
    }

    // --- Compilation ok.
    writeMessage(
      context.output,
      `Project file ${buildRoot} successfully compiled.`,
      "green"
    );

    return commandSuccess;
  }
}
