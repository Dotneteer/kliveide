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
import { activateOutputPaneAction, activateToolAction } from "@state/actions";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";
import {
  BANKED_MEMORY_EDITOR,
  BANKED_MEMORY_PANEL_ID,
  DISASSEMBLY_EDITOR,
  DISASSEMBLY_PANEL_ID
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
    if (documentHubService.isOpen(BANKED_MEMORY_PANEL_ID)) {
      documentHubService.setActiveDocument(BANKED_MEMORY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        {
          id: BANKED_MEMORY_PANEL_ID,
          name: "Machine Memory",
          type: BANKED_MEMORY_EDITOR,
          iconName: "memory-icon",
          iconFill: "--console-ansi-bright-cyan"
        },
        undefined,
        false
      );
    }
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
    if (documentHubService.isOpen(DISASSEMBLY_PANEL_ID)) {
      documentHubService.setActiveDocument(DISASSEMBLY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        {
          id: DISASSEMBLY_PANEL_ID,
          name: "Z80 Disassembly",
          type: DISASSEMBLY_EDITOR,
          iconName: "disassembly-icon",
          iconFill: "--console-ansi-bright-cyan"
        },
      undefined,
        false
      );
    }
    return commandSuccess;
  }
}
