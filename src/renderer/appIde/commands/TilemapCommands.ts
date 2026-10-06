import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { MI_ZXNEXT } from "@common/machines/constants";
import { TILEMAP_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import {
  requestTilemapReveal,
  type TilemapRevealRequest
} from "@renderer/features/tilemap/tilemapReveal";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError
} from "@renderer/appIde/services/ide-commands";

/*
 * The Tilemap Inspector's commands (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.4, Q2): two commands, one
 * document. Both open `$tilemap`, each focused on its own view.
 */

async function openTilemapInspector(
  context: IdeCommandContext,
  request: TilemapRevealRequest
): Promise<IdeCommandResult> {
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  if (machineId !== MI_ZXNEXT) {
    return commandError("The tilemap exists on the ZX Spectrum Next only");
  }
  requestTilemapReveal(request);
  const documentHubService = context.service.projectService.getActiveDocumentHubService();
  if (documentHubService.isOpen(TILEMAP_PANEL_ID)) {
    await documentHubService.setActiveDocument(TILEMAP_PANEL_ID);
  } else {
    await documentHubService.openDocument(createSpecialDocument(TILEMAP_PANEL_ID), undefined, false);
  }
  return commandSuccess;
}

/** `show-tilemap [<col> <row>]`: opens the Tilemap Inspector on its Map view, selecting a cell. */
export class ShowTilemapCommand extends IdeCommandBase<{ col?: number; row?: number }> {
  readonly id = "show-tilemap";
  readonly description = "Displays the Tilemap Inspector's map, optionally selecting a cell";
  readonly usage = "show-tilemap [<col> <row>]";
  readonly aliases = ["shtm"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [
      { name: "col", type: "number", minValue: 0, maxValue: 79 },
      { name: "row", type: "number", minValue: 0, maxValue: 31 }
    ]
  };

  async validateCommandArgs(
    _context: IdeCommandContext,
    args: { col?: number; row?: number }
  ): Promise<ValidationMessage[]> {
    return args.col !== undefined && args.row === undefined
      ? [validationError("Give both a column and a row")]
      : [];
  }

  async execute(context: IdeCommandContext, args: { col?: number; row?: number }): Promise<IdeCommandResult> {
    const cell = args?.col !== undefined && args?.row !== undefined ? { col: args.col, row: args.row } : undefined;
    return openTilemapInspector(context, { view: "map", cell });
  }
}

/** `show-tiles [<index>]`: opens the Tilemap Inspector on its Tiles view, selecting a tile. */
export class ShowTilesCommand extends IdeCommandBase<{ index?: number }> {
  readonly id = "show-tiles";
  readonly description = "Displays the Tilemap Inspector's tile definitions, optionally selecting a tile (0-511)";
  readonly usage = "show-tiles [<index>]";
  readonly aliases = ["shtl"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "index", type: "number", minValue: 0, maxValue: 511 }]
  };

  async execute(context: IdeCommandContext, args: { index?: number }): Promise<IdeCommandResult> {
    return openTilemapInspector(context, { view: "tiles", tile: args?.index });
  }
}
