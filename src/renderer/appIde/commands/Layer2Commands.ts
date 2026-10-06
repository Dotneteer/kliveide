import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { MI_ZXNEXT } from "@common/machines/constants";
import { LAYER2_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { requestLayer2Reveal, type Layer2Source } from "@renderer/features/layer2/layer2Reveal";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError
} from "@renderer/appIde/services/ide-commands";

/*
 * The Layer 2 Inspector's command (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.4): opens `$layer2`,
 * optionally on a source.
 */

const SOURCES: Layer2Source[] = ["displayed", "shadow", "window"];

/** `show-layer2 [displayed|shadow|window]`: opens the Layer 2 Inspector. */
export class ShowLayer2Command extends IdeCommandBase<{ source?: string }> {
  readonly id = "show-layer2";
  readonly description =
    "Displays the Layer 2 Inspector, optionally on a source: displayed ($12), shadow ($13) or window (the $123B write window)";
  readonly usage = "show-layer2 [displayed|shadow|window]";
  readonly aliases = ["shl2"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "source", type: "string" }]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: { source?: string }): Promise<ValidationMessage[]> {
    return args.source !== undefined && !SOURCES.includes(args.source.toLowerCase() as Layer2Source)
      ? [validationError("The source is displayed, shadow or window")]
      : [];
  }

  async execute(context: IdeCommandContext, args: { source?: string }): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) {
      return commandError("Layer 2 exists on the ZX Spectrum Next only");
    }
    requestLayer2Reveal({ source: args?.source?.toLowerCase() as Layer2Source | undefined });
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(LAYER2_PANEL_ID)) {
      await documentHubService.setActiveDocument(LAYER2_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(LAYER2_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}
