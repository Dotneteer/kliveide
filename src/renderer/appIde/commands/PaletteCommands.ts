import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { MI_ZXNEXT } from "@common/machines/constants";
import { PALETTES_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import type { NextPaletteDeviceId } from "@renderer/features/next-palette/nextPaletteDevices";
import { requestPaletteReveal } from "@renderer/features/next-palette/paletteReveal";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError
} from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";

/*
 * The Palette document's commands (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §4). The Next Palettes
 * panel's pop-out button and View › Machine Views › Palettes run `show-palettes`.
 */

/** The device names `show-palettes` takes: the `pal:` spellings */
const DEVICE_ARGS: Record<string, NextPaletteDeviceId> = {
  ula: "ula",
  l2: "layer2",
  spr: "sprites",
  tm: "tilemap"
};

/** `show-palettes [ula|l2|spr|tm]`: opens the Palette document, showing a device when one is named. */
export class ShowPalettesCommand extends IdeCommandBase<{ device?: string }> {
  readonly id = "show-palettes";
  get description() {
    return t("commands.palettes.showDescription");
  }
  readonly usage = "show-palettes [ula|l2|spr|tm]";
  readonly aliases = ["shpal"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "device", type: "string" }]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: { device?: string }): Promise<ValidationMessage[]> {
    if (args?.device !== undefined && !(args.device.toLowerCase() in DEVICE_ARGS)) {
      return [validationError(t("commands.palettes.badDevice", { device: args.device }))];
    }
    return [];
  }

  async execute(context: IdeCommandContext, args: { device?: string }): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) return commandError(t("commands.palettes.nextOnly"));
    const device = args?.device ? DEVICE_ARGS[args.device.toLowerCase()] : undefined;
    if (device) requestPaletteReveal(device);
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(PALETTES_PANEL_ID)) {
      await documentHubService.setActiveDocument(PALETTES_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(PALETTES_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-palettes`: closes the Palette document. */
export class HidePalettesCommand extends IdeCommandBase {
  readonly id = "hide-palettes";
  get description() {
    return t("commands.palettes.hideDescription");
  }
  readonly usage = "hide-palettes";
  readonly aliases = ["hpal"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(PALETTES_PANEL_ID);
    return commandSuccess;
  }
}
