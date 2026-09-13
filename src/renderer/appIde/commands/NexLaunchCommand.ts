import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { CodeToInject } from "@abstractions/CodeToInject";

import { MI_ZXNEXT } from "@common/machines/constants";
import { isNexFilePath, nexSdCardTarget } from "@common/utils/nex-launch-paths";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  validationError,
  writeMessage
} from "../services/ide-commands";

export type LaunchNexCommandArgs = {
  file: string;
  "-d"?: boolean;
};

/**
 * Runs an arbitrary `.nex` file, optionally with debugging.
 *
 * Until now the only way to run a NEX was to *build* one: `run`/`debug` compiled the project,
 * exported the configured NEX, and launched that. A NEX sitting in the project — downloaded,
 * produced by another assembler, or an older build — could be inspected in the viewer but not run.
 *
 * The mechanism is the same one the build path uses, because there is no direct loader (that was
 * decided against: a NEX is a program run *under* NextZXOS, not a firmware image). Copy the file
 * into the emulated SD card, then let `getCodeInjectionFlow` boot NextZXOS and type
 * `.nexload <path>` at its command line.
 *
 * The command needs no project, which is the point: the Explorer menu and the NEX viewer both reach
 * it, and so does a script.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §8.
 */
export class LaunchNexCommand extends IdeCommandBase<LaunchNexCommandArgs> {
  readonly id = "nex-run";
  readonly description = "Copies a .nex file to the ZX Spectrum Next SD card and runs it";
  readonly aliases = ["nexrun"];
  readonly usage = "nex-run <nex-file> [-d]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-d"]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: LaunchNexCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];

    if (!args.file?.trim()) {
      messages.push(validationError("The NEX file path cannot be empty."));
    } else if (!isNexFilePath(args.file)) {
      messages.push(validationError("The file to launch must be a .nex file."));
    }

    // --- NextZXOS is what loads a NEX, so the machine has to be the one that runs it. Silently
    // --- switching machines would throw away whatever the user currently has running.
    const machineId = context.store.getState().emulatorState?.machineId;
    if (machineId !== MI_ZXNEXT) {
      messages.push(
        validationError("Running a NEX file requires the current machine to be ZX Spectrum Next.")
      );
    }

    return messages;
  }

  async execute(
    context: IdeCommandContext,
    args: LaunchNexCommandArgs
  ): Promise<IdeCommandResult> {
    const hostPath = args.file.trim();
    const sdPath = nexSdCardTarget(hostPath);
    const debug = !!args["-d"];

    // --- Stop first: the card image is a file on disk that the running machine also reads, and the
    // --- build-and-run path stops for the same reason before exporting.
    await context.emuApi.issueMachineCommand("stop");

    try {
      await context.mainApi.copyToSdCard(hostPath, sdPath);
    } catch (err) {
      return commandError(
        `Could not copy ${hostPath} to the SD card as ${sdPath}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    writeMessage(context.output, `${hostPath} copied to the SD card as ${sdPath}.`, "green");

    // --- The Next's injection flow injects nothing: it boots NextZXOS and types `.nexload`, with a
    // --- `KeepPc` step so the OS decides where execution goes. So the only part of this that is
    // --- read is the model, and `additionalInfo` — the card path to type.
    const codeToInject: CodeToInject = {
      model: MI_ZXNEXT,
      segments: [],
      options: {}
    };

    await context.emuApi.runCodeCommand(codeToInject, sdPath, debug, false);

    return commandSuccessWith(
      debug ? `${sdPath} started in debug mode.` : `${sdPath} started.`
    );
  }
}
