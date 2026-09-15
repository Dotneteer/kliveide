import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { NexFileAnnotations } from "../DocumentPanels/Next/nexAnnotations";

import { MI_ZXNEXT } from "@common/machines/constants";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa2,
  toHexa4,
  validationError
} from "../services/ide-commands";
import { getNexAnnotationPath } from "../DocumentPanels/Next/nexAnnotations";
import {
  loadNexAnnotationSidecar,
  saveNexAnnotationSubtree
} from "../DocumentPanels/Next/nexAnnotationSidecar";
import {
  peekNexAnnotationSession,
  updateNexAnnotationSession
} from "../DocumentPanels/Next/nexAnnotationSession";
import { getNexLoad } from "../DocumentPanels/Next/nexLoadSession";
import { bankSiteAtAddress } from "../DocumentPanels/Next/nexLiveSymbols";
import { promoteLabelAt } from "../DocumentPanels/Next/nexLabelPromotion";

export type NexLabelCommandArgs = {
  name: string;
  address?: number;
};

/**
 * Names the address the machine is stopped at, in the launched NEX's annotations.
 *
 * Closes the reverse-engineering loop. Labels have flowed one way — written in the NEX viewer, read
 * in its listing and (since §13.1) in the live disassembly — but the moment you actually work out
 * what a routine *is*, you are paused in the debugger, and writing it down meant leaving. Now the
 * name goes in from where the discovery happened, and the live disassembly is using it on the next
 * refresh.
 *
 * A **local** label, always: the address is only meaningful as "offset X in bank B", because the
 * same routine sits at a different Z80 address the next time its bank is paged elsewhere.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §13.3.
 */
export class NexLabelCommand extends IdeCommandBase<NexLabelCommandArgs> {
  readonly id = "nex-label";
  readonly description =
    "Adds a label to the launched NEX's annotations at the address the machine is stopped at";
  readonly aliases = ["nl"];
  readonly usage = "nex-label <name> [<address>]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "name", type: "string" }],
    optional: [{ name: "address", type: "number" }]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: NexLabelCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];

    if (!args.name?.trim()) {
      messages.push(validationError("The label name cannot be empty."));
    }

    const emuState = context.store.getState().emulatorState;
    if (emuState?.machineId !== MI_ZXNEXT) {
      messages.push(validationError("NEX annotations belong to the ZX Spectrum Next."));
    }

    /*
     * Paused, unless an address is given explicitly.
     *
     * A running machine's program counter is somewhere different by the time this command finishes
     * reading it, so naming "where we are" would name an arbitrary instruction — the same reason
     * §11.4's spotlight only shows while paused.
     */
    if (args.address === undefined && emuState?.machineState !== MachineControllerState.Paused) {
      messages.push(
        validationError(
          "Pause the machine, or give an address — a running machine is not at one address."
        )
      );
    }

    return messages;
  }

  async execute(
    context: IdeCommandContext,
    args: NexLabelCommandArgs
  ): Promise<IdeCommandResult> {
    const loaded = getNexLoad();
    if (!loaded) {
      return commandError("No NEX file has been launched in this session.");
    }

    // --- Where to name: the given address, or wherever the machine is stopped.
    let address = args.address;
    if (address === undefined) {
      try {
        address = (await context.emuApi.getCpuStateChunk())?.pcValue;
      } catch (err) {
        return commandError(
          `Could not read the program counter: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    if (address === undefined) {
      return commandError("Could not determine which address to name.");
    }

    // --- Which bank is there *now*. The address alone does not say: the answer changes as the
    // --- program pages, which is why the label has to be bank-relative.
    let site: ReturnType<typeof bankSiteAtAddress>;
    try {
      const mapping = await context.emuApi.getNextMemoryMapping();
      site = bankSiteAtAddress(
        mapping?.pageInfo?.map((page) => page?.bank8k),
        address
      );
    } catch (err) {
      return commandError(
        `Could not read the memory mapping: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    if (!site) {
      return commandError(
        `$${toHexa4(address)} is not in a RAM bank — there is no bank offset to name.`
      );
    }
    if (!loaded.banks.includes(site.bank)) {
      return commandError(
        `Bank $${toHexa2(site.bank)} is paged in at $${toHexa4(address)}, but ${loaded.fileName} ` +
          "does not contain it."
      );
    }

    const sidecarPath = getNexAnnotationPath(loaded.path);
    /*
     * A live session's copy wins, and decides how the edit is written.
     *
     * With a viewer open, its annotations may carry edits the user has not saved — so this edit
     * joins them and inherits the same "written when you ask" policy (§4.5). Reading the file
     * instead would drop those edits; saving the file with them would flush edits the user has not
     * finished. With no viewer open there is nothing in memory to conflict with, and writing
     * through is the only way the label is not lost.
     */
    const session = peekNexAnnotationSession(sidecarPath);
    let annotations: NexFileAnnotations | undefined = session;
    if (!annotations) {
      const state = await loadNexAnnotationSidecar(
        context.service.projectService,
        { fullPath: sidecarPath },
        loaded.banks
      );
      if (state.status !== "loaded") {
        return commandError(
          `${loaded.fileName} has no annotations to add a label to — create them in its viewer first.`
        );
      }
      annotations = state.annotations;
    }

    const promoted = promoteLabelAt(annotations, site, args.name);
    if (!promoted.ok) {
      return commandError(promoted.error);
    }

    const where =
      `bank $${toHexa2(site.bank)} offset $${toHexa4(site.bankOffset)} ` +
      `(address $${toHexa4(address)})`;
    const alsoNamed = promoted.replaced ? ` It is also named ${promoted.replaced}.` : "";

    if (session) {
      updateNexAnnotationSession(sidecarPath, promoted.annotations);
      return commandSuccessWith(
        `${args.name.trim()} added at ${where}. Save the annotations to keep it.${alsoNamed}`
      );
    }

    try {
      await saveNexAnnotationSubtree(
        context.service.projectService,
        sidecarPath,
        promoted.annotations
      );
    } catch (err) {
      return commandError(
        `Could not write ${sidecarPath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return commandSuccessWith(`${args.name.trim()} added at ${where}.${alsoNamed}`);
  }
}
