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
  MEMORY_PANEL_ID,
  DISASSEMBLY_PANEL_ID
} from "@common/state/common-ids";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { SETTING_IDE_ACTIVE_OUTPUT_PANE, SETTING_IDE_ACTIVE_TOOL, SETTING_IDE_SHOW_TOOLS } from "@common/settings/setting-const";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { revealWhenMounted } from "@renderer/appIde/navigation/addressNavigationAdapters";
import { t } from "@common/i18n/i18n";

type SelectOutputArgs = {
  paneId: string;
};

export class SelectOutputPaneCommand extends IdeCommandBase<SelectOutputArgs> {
  readonly id = "outp";
  get description() {
    return t("commands.outp.description");
  }
  readonly usage = "outp <paneId>";
  readonly argumentInfo?: CommandArgumentInfo = {
    mandatory: [{ name: "paneId" }]
  };

  async execute(context: IdeCommandContext, args: SelectOutputArgs): Promise<IdeCommandResult> {
    // --- Check if the specified panel exists
    if (!outputPaneRegistry.find((p) => p.id === args.paneId)) {
      return commandError(t("commands.outp.unknown", { id: args.paneId }));
    }

    // --- Select the panel
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_SHOW_TOOLS, true);
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_OUTPUT_PANE, args.paneId);
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_TOOL, "output");

    // --- Done.
    writeSuccessMessage(context.output, t("commands.outp.displayed", { id: args.paneId }));
    return commandSuccess;
  }
}

/**
 * `show-memory [<address>]`: displays the machine memory panel and, with an address, reveals it there
 * (in the 64K view) — the sibling of `show-disass <address>` the graphics finder's *Show in memory*
 * runs (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.3).
 */
export class ShowMemoryCommand extends IdeCommandBase<{ address?: number }> {
  readonly id = "show-memory";
  get description() {
    return t("commands.memoryPanel.showDescription");
  }
  readonly usage = "show-memory [<address>]";
  readonly aliases = ["shmem"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "address", type: "number", minValue: 0, maxValue: 0xffff }]
  };

  async execute(context: IdeCommandContext, args?: { address?: number }): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(MEMORY_PANEL_ID)) {
      await documentHubService.setActiveDocument(MEMORY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        createSpecialDocument(MEMORY_PANEL_ID),
        undefined,
        false
      );
    }
    if (args?.address !== undefined) {
      await revealWhenMounted(documentHubService, MEMORY_PANEL_ID, {
        kind: "address",
        address: args.address & 0xffff,
        fullView: true
      });
    }
    return commandSuccess;
  }
}

export class HideMemoryCommand extends IdeCommandBase {
  readonly id = "hide-memory";
  get description() {
    return t("commands.memoryPanel.hideDescription");
  }
  readonly usage = "hide-memory";
  readonly aliases = ["hmem"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(MEMORY_PANEL_ID);
    return commandSuccess;
  }
}

/**
 * `show-disass [<address>]`: displays the live disassembly panel and, with an address, reveals it
 * there (in the 64K view). The reusable "Show in Disassembly" entry point: any view that knows an
 * address runs this command (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.8).
 */
export class ShowDisassemblyCommand extends IdeCommandBase<{ address?: number }> {
  readonly id = "show-disass";
  get description() {
    return t("commands.disass.showDescription");
  }
  readonly usage = "show-disass [<address>]";
  readonly aliases = ["shdis"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "address", type: "number", minValue: 0, maxValue: 0xffff }]
  };

  async execute(context: IdeCommandContext, args: { address?: number }): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(DISASSEMBLY_PANEL_ID)) {
      await documentHubService.setActiveDocument(DISASSEMBLY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        createSpecialDocument(DISASSEMBLY_PANEL_ID),
        undefined,
        false
      );
    }
    if (args?.address !== undefined) {
      await revealWhenMounted(documentHubService, DISASSEMBLY_PANEL_ID, {
        kind: "address",
        address: args.address & 0xffff,
        fullView: true
      });
    }
    return commandSuccess;
  }
}

export class HideDisassemblyCommand extends IdeCommandBase {
  readonly id = "hide-disass";
  get description() {
    return t("commands.disass.hideDescription");
  }
  readonly usage = "hide-disass";
  readonly aliases = ["hdis"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(DISASSEMBLY_PANEL_ID);
    return commandSuccess;
  }
}
