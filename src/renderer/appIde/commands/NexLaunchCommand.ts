import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { NexHeader } from "../DocumentPanels/Next/nexFileLoader";

import { MI_ZXNEXT } from "@common/machines/constants";
import { isNexFilePath, nexSdCardTarget } from "@common/utils/nex-launch-paths";
import { loadNexFileContents } from "../DocumentPanels/Next/nexFileLoader";
import { getEntryPointBreakpointSite } from "../DocumentPanels/Next/nexEntryState";
import { clearNexLoad, recordNexLoad } from "../DocumentPanels/Next/nexLoadSession";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa2,
  toHexa4,
  validationError,
  writeMessage
} from "../services/ide-commands";

export type LaunchNexCommandArgs = {
  file: string;
  "-d"?: boolean;
  "-e"?: boolean;
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
  readonly usage = "nex-run <nex-file> [-d] [-e]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-d", "-e"]
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
    const breakAtEntry = !!args["-e"];

    // --- `-e` implies `-d`: there is no such thing as stopping at the entry point without
    // --- debugging, and making the caller pass both would only create a combination that silently
    // --- does nothing.
    const debug = !!args["-d"] || breakAtEntry;

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

    /*
     * The header, read once and used for two things.
     *
     * Unconditionally, not only for `-e`: the banks it declares are what lets the Memory Mapping
     * panel say which of its slots hold banks of this file (§11.5). The read costs a file the
     * `copyToSdCard` above has just read and written in full, so it is marginal next to what this
     * command already does.
     */
    const header = await this.readNexHeader(context, hostPath);

    // --- Record it before the run, so a panel refreshed mid-launch already has the answer. A
    // --- failed read clears the previous record rather than leaving it: attributing this
    // --- program's banks to the file launched before it is the one actively misleading outcome.
    if (header.header) {
      recordNexLoad(hostPath, banksOf(header.header));
    } else {
      clearNexLoad();
    }

    if (breakAtEntry) {
      if (header.error) {
        // --- Only `-e` treats an unreadable header as fatal: it cannot place its stop without one,
        // --- and a debug run that can never stop looks exactly like a hung emulator.
        return commandError(header.error);
      }
      const armed = this.armEntryPointStop(header.header);
      if (armed.site) {
        await context.emuApi.setBreakpoint({
          bank: armed.site.bank,
          bankOffset: armed.site.bankOffset,
          exec: true,
          oneShot: true,
          owner: { kind: "session" }
        });
      }
      writeMessage(context.output, armed.message, armed.site ? "green" : "yellow");
    }

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

  /**
   * Read the NEX header, or say why it could not be read.
   *
   * The whole file, for 512 bytes. Worth it to share the one parser the viewer uses: a second,
   * bespoke header reader is how the two would come to disagree about which bank the entry point is
   * in.
   */
  private async readNexHeader(
    context: IdeCommandContext,
    hostPath: string
  ): Promise<{ header?: NexHeader; error?: string }> {
    try {
      const contents = await context.mainApi.readBinaryFile(hostPath);
      const loaded = loadNexFileContents(contents);
      if (loaded.error || !loaded.fileInfo) {
        return { error: `Could not read the NEX header of ${hostPath}: ${loaded.error}` };
      }
      return { header: loaded.fileInfo.header };
    } catch (err) {
      return {
        error: `Could not read ${hostPath}: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  /**
   * Where a one-shot breakpoint on the NEX's own entry point goes.
   *
   * The entry point is where NextZXOS hands control to the program, and it is *not* an address the
   * user could have set a breakpoint on beforehand: which bank is at `$C000` is decided by the
   * header, and the program is not in memory until the loader puts it there. So the breakpoint is
   * bank-relative — the entry bank and the offset inside it — which is exactly the shape Phase 2
   * added, and it resolves itself once the bank is paged in.
   *
   * **Session-owned and one-shot**, at the call site. Session ownership is what lets it fire while
   * the launch flow's keystrokes are still in flight (`suppressUserBreakpoints`), and it keeps the
   * breakpoint out of `.kliveproject` and out of the NEX's sidecar — nobody wants a stop at the
   * entry point to reappear next week. One-shot means the execution loop deletes it the moment it
   * fires, so a second launch does not accumulate a second copy.
   *
   * Armed *before* the flow rather than after, because the flow ends with the machine already
   * running and the program possibly already entered.
   */
  private armEntryPointStop(
    header: NexHeader
  ): { message: string; site?: { bank: number; bankOffset: number } } {
    const site = getEntryPointBreakpointSite(header);
    if (!site) {
      // --- Not an error: the file is launchable, only its entry point is not somewhere a bank
      // --- breakpoint can name. Running it without the stop is more useful than refusing.
      return {
        message:
          `The entry point ($${toHexa4(header.programCounter)}) is below $4000, which is ` +
          "ROM when the program starts, so there is no bank to break in. Running without the " +
          "entry-point stop."
      };
    }

    return {
      site,
      message:
        `Will break at the entry point: bank $${toHexa2(site.bank)}, offset ` +
        `$${toHexa4(site.bankOffset)} (address $${toHexa4(header.programCounter)}).`
    };
  }
}

/**
 * The 16K banks a NEX header declares.
 *
 * `bankFlags` is 112 booleans indexed by bank number, which is the format's own way of saying
 * which banks the file carries.
 */
function banksOf(header: NexHeader): number[] {
  const banks: number[] = [];
  header.bankFlags?.forEach((present, bank) => {
    if (present) banks.push(bank);
  });
  return banks;
}
