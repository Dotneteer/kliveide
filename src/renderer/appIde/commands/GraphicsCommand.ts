import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { GRAPHICS_PANEL_ID } from "@common/state/common-ids";
import { GRAPHIC_LAYOUTS, type GraphicLayout, type GraphicsLook } from "@common/reverse/graphicsDecode";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { requestGraphicsReveal } from "@renderer/features/graphics/graphicsReveal";
import { IdeCommandBase, commandSuccess, validationError } from "../services/ide-commands";

type GfxArgs = {
  address?: number;
  "-w"?: number;
  "-h"?: number;
  "-layout"?: string;
  "-bank"?: number;
};

/**
 * `gfx [<address>] [-w <width>] [-h <height>] [-layout linear|cells|columns|screen] [-bank <n>]`:
 * opens the Graphics document — the graphics finder over the paused machine — at an address
 * (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.3). `-bank` shows one partition instead of the
 * 64K view.
 */
export class GraphicsCommand extends IdeCommandBase<GfxArgs> {
  readonly id = "gfx";
  readonly description = "Shows memory as graphics: the graphics finder, optionally at an address";
  readonly aliases = ["show-graphics"];
  readonly usage = "gfx [<address>] [-w <width>] [-h <height>] [-layout linear|cells|columns|screen] [-bank <n>]";
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "address", type: "number", minValue: 0, maxValue: 0xffff }],
    namedOptions: [
      { name: "-w", type: "number", minValue: 1, maxValue: 32 },
      { name: "-h", type: "number", minValue: 1, maxValue: 256 },
      { name: "-layout", type: "string" },
      { name: "-bank", type: "number" }
    ]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: GfxArgs): Promise<ValidationMessage[]> {
    const layout = args["-layout"]?.toLowerCase();
    return layout !== undefined && !GRAPHIC_LAYOUTS.includes(layout as GraphicLayout)
      ? [validationError(`-layout: use ${GRAPHIC_LAYOUTS.join(", ")}`)]
      : [];
  }

  async execute(context: IdeCommandContext, args: GfxArgs): Promise<IdeCommandResult> {
    const look: Partial<GraphicsLook> = {
      ...(args["-w"] !== undefined ? { width: args["-w"] } : {}),
      ...(args["-h"] !== undefined ? { height: args["-h"] } : {}),
      ...(args["-layout"] ? { layout: args["-layout"].toLowerCase() as GraphicLayout } : {})
    };
    requestGraphicsReveal({
      ...(args.address !== undefined ? { address: args.address & 0xffff } : {}),
      ...(Object.keys(look).length ? { look } : {}),
      ...(args["-bank"] !== undefined ? { partition: args["-bank"] } : {})
    });
    const hub = context.service.projectService.getActiveDocumentHubService();
    if (hub.isOpen(GRAPHICS_PANEL_ID)) {
      await hub.setActiveDocument(GRAPHICS_PANEL_ID);
    } else {
      await hub.openDocument(createSpecialDocument(GRAPHICS_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}
