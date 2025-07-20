import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";
import { outputPaneRegistry } from "@renderer/registry";
import {
  setVolatileDocStateAction,
} from "@state/actions";
import {
  MEMORY_EDITOR,
  MEMORY_PANEL_ID,
  DISASSEMBLY_PANEL_ID,
  DISASSEMBLY_EDITOR
} from "@common/state/common-ids";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { SETTING_IDE_ACTIVE_OUTPUT_PANE, SETTING_IDE_ACTIVE_TOOL, SETTING_IDE_SHOW_TOOLS } from "@common/settings/setting-const";

type SelectOutputArgs = {
  paneId: string;
};

export class SelectOutputPaneCommand extends IdeCommandBase<SelectOutputArgs> {
  readonly id = "outp";
  readonly description = "Selects the specified output panel and navigates there";
  readonly usage = "outp <paneId>";
  readonly argumentInfo?: CommandArgumentInfo = {
    mandatory: [{ name: "paneId" }]
  };

  async execute(context: IdeCommandContext, args: SelectOutputArgs): Promise<IdeCommandResult> {
    // --- Check if the specified panel exists
    if (!outputPaneRegistry.find((p) => p.id === args.paneId)) {
      return commandError(`Unknown output pane '${args.paneId}'`);
    }

    // --- Select the panel
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_SHOW_TOOLS, true);
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_OUTPUT_PANE, args.paneId);
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_TOOL, "output");

    // --- Done.
    writeSuccessMessage(context.output, `Output panel ${args.paneId} is displayed.`);
    return commandSuccess;
  }
}

export class ShowMemoryCommand extends IdeCommandBase {
  readonly id = "show-memory";
  readonly description = "Displays the machine memory panel";
  readonly usage = "show-memory";
  readonly aliases = ["shmem"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(MEMORY_PANEL_ID)) {
      documentHubService.setActiveDocument(MEMORY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        {
          id: MEMORY_PANEL_ID,
          name: "Machine Memory",
          type: MEMORY_EDITOR,
          iconName: "memory-icon",
          iconFill: "--console-ansi-bright-cyan"
        },
        undefined,
        false
      );
      context.store.dispatch(setVolatileDocStateAction(MEMORY_PANEL_ID, true), "ide");
    }
    return commandSuccess;
  }
}

export class HideMemoryCommand extends IdeCommandBase {
  readonly id = "hide-memory";
  readonly description = "Hides the machine memory panel";
  readonly usage = "hide-memory";
  readonly aliases = ["hmem"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(MEMORY_PANEL_ID);
    context.store.dispatch(setVolatileDocStateAction(MEMORY_PANEL_ID, false), "ide");
    return commandSuccess;
  }
}

export class ShowDisassemblyCommand extends IdeCommandBase {
  readonly id = "show-disass";
  readonly description = "Displays the disassembly panel";
  readonly usage = "show-disass";
  readonly aliases = ["shdis"];


  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(DISASSEMBLY_PANEL_ID)) {
      documentHubService.setActiveDocument(DISASSEMBLY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        {
          id: DISASSEMBLY_PANEL_ID,
          name: "Disassembly",
          type: DISASSEMBLY_EDITOR,
          iconName: "disassembly-icon",
          iconFill: "--console-ansi-bright-cyan"
        },
        undefined,
        false
      );
      context.store.dispatch(setVolatileDocStateAction(DISASSEMBLY_PANEL_ID, true), "ide");
    }
    return commandSuccess;
  }
}

export class HideDisassemblyCommand extends IdeCommandBase {
  readonly id = "hide-disass";
  readonly description = "Hides the disassembly panel";
  readonly usage = "hide-disass";
  readonly aliases = ["hdis"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(DISASSEMBLY_PANEL_ID);
    context.store.dispatch(setVolatileDocStateAction(DISASSEMBLY_PANEL_ID, false), "ide");
    return commandSuccess;
  }
}
