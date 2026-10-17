import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { MI_ZXNEXT } from "@common/machines/constants";
import { SETTING_EMU_SHOW_NEXT_LAYERS } from "@common/settings/setting-const";
import { setNextLayersAction } from "@common/state/actions";
import { LAYERS_PANEL_ID } from "@common/state/common-ids";
import {
  applyLayersCommand,
  describeLayerView,
  EMPTY_LAYER_VIEW,
  parseLayersCommand
} from "@common/zxnext/layers/layerView";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError,
  writeInfoMessage
} from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";

/*
 * The ZX Spectrum Next layer commands (`.plans/LAYER_COMPOSITION_PLAN.md` D4, D9).
 */

const isNext = (context: IdeCommandContext) =>
  context.service.machineService.getMachineInfo()?.machine?.machineId === MI_ZXNEXT;

/**
 * `layers [ula|tm|l2|spr|all|transparency] [on|off|solo]`: hides, shows or solos a layer of the
 * emulator screen, or lists the debug view. The same state as the Layers strip and the Machine menu.
 */
export class LayersCommand extends IdeCommandBase<{ layer?: string; action?: string }> {
  readonly id = "layers";
  get description() {
    return t("commands.layers.description");
  }
  readonly usage = "layers [ula|tm|l2|spr|all|transparency] [on|off|solo]";
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [
      { name: "layer", type: "string" },
      { name: "action", type: "string" }
    ]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: { layer?: string; action?: string }): Promise<ValidationMessage[]> {
    const parsed = parseLayersCommand(args.layer, args.action);
    return typeof parsed === "string" ? [validationError(parsed)] : [];
  }

  async execute(context: IdeCommandContext, args: { layer?: string; action?: string }): Promise<IdeCommandResult> {
    if (!isNext(context)) return commandError(t("commands.layers.nextOnly"));
    const parsed = parseLayersCommand(args?.layer, args?.action);
    if (typeof parsed === "string") return commandError(parsed);
    const current = context.store.getState()?.emulatorState?.nextLayers ?? EMPTY_LAYER_VIEW;
    const next = applyLayersCommand(current, parsed);
    if (parsed.target) {
      context.store.dispatch(setNextLayersAction(next), context.messageSource);
      // --- A toggle shows the strip, so the change is always in sight (Q3)
      await context.mainApi.setGlobalSettingsValue(SETTING_EMU_SHOW_NEXT_LAYERS, true);
    }
    for (const line of describeLayerView(next)) writeInfoMessage(context.output, line);
    return commandSuccess;
  }
}

/** `show-layers`: opens the Layers document. */
export class ShowLayersCommand extends IdeCommandBase {
  readonly id = "show-layers";
  get description() {
    return t("commands.layers.showDescription");
  }
  readonly usage = "show-layers";
  readonly aliases = ["shly"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    if (!isNext(context)) return commandError(t("commands.layers.nextOnly"));
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(LAYERS_PANEL_ID)) {
      await documentHubService.setActiveDocument(LAYERS_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(LAYERS_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}
