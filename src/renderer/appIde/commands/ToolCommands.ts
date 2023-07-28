import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError,
  writeSuccessMessage
} from "../services/ide-commands";
import { ValidationMessage } from "../abstractions/ValidationMessage";
import { Token } from "../services/command-parser";
import { outputPaneRegistry } from "@/renderer/registry";
import { activateOutputPaneAction, activateToolAction } from "@/common/state/actions";

export class SelectOutputPaneCommand extends IdeCommandBase {
  readonly id = "outp";
  readonly description = "Selects the specified output panel and navigates there";
  readonly usage = "outp panelId";

  private paneId: string | undefined;

  /**
   * Validates the input arguments
   * @param _args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs (
    args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
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
