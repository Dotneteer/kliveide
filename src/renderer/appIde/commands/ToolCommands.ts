import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError,
  writeSuccessMessage
} from "../services/ide-commands";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import { outputPaneRegistry } from "@renderer/registry";
import {
  activateOutputPaneAction,
  activateToolAction,
  setVolatileDocStateAction
} from "@state/actions";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";
import {
  MEMORY_EDITOR,
  MEMORY_PANEL_ID,
  BANKED_DISASSEMBLY_PANEL_ID,
  BANKED_DISASSEMBLY_EDITOR
} from "@common/state/common-ids";

export class SelectOutputPaneCommand extends IdeCommandBase {
  readonly id = "outp";
  readonly description =
    "Selects the specified output panel and navigates there";
  readonly usage = "outp panelId";

  private paneId: string | undefined;

  /**
   * Validates the input arguments
   * @param _args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length !== 1) {
      return validationError("This command expects 1 argument");
    }
    this.paneId = args[0].text;
    return [];
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Check if the specified panel exists
    if (!outputPaneRegistry.find(p => p.id === this.paneId)) {
      return commandError(`Unknown output pane '${this.paneId}'`);
    }

    // --- Select the panel
    context.store.dispatch(activateOutputPaneAction(this.paneId));
    context.store.dispatch(activateToolAction("output"));

    // --- Done.
    writeSuccessMessage(
      context.output,
      `Output panel ${this.paneId} is displayed.`
    );
    return commandSuccess;
  }
}

export class ShowMemoryCommand extends CommandWithNoArgBase {
  readonly id = "show-memory";
  readonly description = "Displays the machine memory panel";
  readonly usage = "show-memory";

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService =
      context.service.projectService.getActiveDocumentHubService();
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
      context.store.dispatch(
        setVolatileDocStateAction(MEMORY_PANEL_ID, true),
        "ide"
      );
    }
    return commandSuccess;
  }
}

export class HideMemoryCommand extends CommandWithNoArgBase {
  readonly id = "hide-memory";
  readonly description = "Hides the machine memory panel";
  readonly usage = "hide-memory";

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService =
      context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(MEMORY_PANEL_ID);
    context.store.dispatch(
      setVolatileDocStateAction(MEMORY_PANEL_ID, false),
      "ide"
    );
    return commandSuccess;
  }
}

export class ShowDisassemblyCommand extends CommandWithNoArgBase {
  readonly id = "show-disass";
  readonly description = "Displays the Z80 disassembly panel";
  readonly usage = "show-disass";

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService =
      context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(BANKED_DISASSEMBLY_PANEL_ID)) {
      documentHubService.setActiveDocument(BANKED_DISASSEMBLY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        {
          id: BANKED_DISASSEMBLY_PANEL_ID,
          name: "Z80 Disassembly",
          type: BANKED_DISASSEMBLY_EDITOR,
          iconName: "disassembly-icon",
          iconFill: "--console-ansi-bright-cyan"
        },
        undefined,
        false
      );
      context.store.dispatch(
        setVolatileDocStateAction(BANKED_DISASSEMBLY_PANEL_ID, true),
        "ide"
      );
    }
    return commandSuccess;
  }
}

export class HideDisassemblyCommand extends CommandWithNoArgBase {
  readonly id = "hide-disass";
  readonly description = "Hides the Z80 disassembly panel";
  readonly usage = "hide-disass";

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService =
      context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(BANKED_DISASSEMBLY_PANEL_ID);
    context.store.dispatch(
      setVolatileDocStateAction(BANKED_DISASSEMBLY_PANEL_ID, false),
      "ide"
    );
    return commandSuccess;
  }
}

