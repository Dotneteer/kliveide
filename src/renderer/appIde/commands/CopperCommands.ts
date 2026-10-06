import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MI_ZXNEXT } from "@common/machines/constants";
import { COPPER_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { requestCopperReveal } from "@renderer/features/copper/copperReveal";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";

/*
 * The ZX Spectrum Next Copper's commands (`.plans/COPPER_DEBUGGING_PLAN.md` §4.5, §4.6). The
 * breakpoint form, `cu:<index>`, lives with the other address specs in `BreakpointCommands.ts`.
 */

/** Refuses a command on any machine but the Next. */
function requireNext(context: IdeCommandContext): IdeCommandResult | undefined {
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  return machineId === MI_ZXNEXT
    ? undefined
    : commandError("The Copper exists on the ZX Spectrum Next only");
}

/**
 * `show-copper [<index>]`: opens the Copper List document and, with an index, reveals that slot.
 */
export class ShowCopperCommand extends IdeCommandBase<{ index?: number }> {
  readonly id = "show-copper";
  readonly description = "Displays the Copper List, optionally revealing a list index";
  readonly usage = "show-copper [<index>]";
  readonly aliases = ["shcop"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "index", type: "number", minValue: 0, maxValue: 0x3ff }]
  };

  async execute(context: IdeCommandContext, args: { index?: number }): Promise<IdeCommandResult> {
    const refused = requireNext(context);
    if (refused) return refused;
    if (args?.index !== undefined) requestCopperReveal(args.index);
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(COPPER_PANEL_ID)) {
      await documentHubService.setActiveDocument(COPPER_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(COPPER_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-copper`: closes the Copper List document. */
export class HideCopperCommand extends IdeCommandBase {
  readonly id = "hide-copper";
  readonly description = "Hides the Copper List";
  readonly usage = "hide-copper";
  readonly aliases = ["hcop"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(COPPER_PANEL_ID);
    return commandSuccess;
  }
}

/**
 * `step-copper`: runs the machine in debug mode until the Copper completes its next instruction,
 * and stops at the end of that Z80 instruction (a one-shot on "any index", §4.6).
 */
export class StepCopperCommand extends IdeCommandBase {
  readonly id = "step-copper";
  readonly description = "Runs until the Copper completes its next instruction";
  readonly usage = "step-copper";
  readonly aliases = ["stcop"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = requireNext(context);
    if (refused) return refused;
    const emuState = context.store.getState().emulatorState;
    if (emuState?.machineState === MachineControllerState.Running && !emuState?.isDebugging) {
      return commandError(
        "The machine is running in normal mode. Pause it (or start it with debugging) before stepping the Copper."
      );
    }
    await context.emuApi.stepCopper();
    writeSuccessMessage(context.output, "Running to the Copper's next instruction");
    return commandSuccess;
  }
}
