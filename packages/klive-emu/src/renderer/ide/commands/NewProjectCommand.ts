import {
  CommandBase,
  CommandContext,
  CommandResult,
  TraceMessage,
  TraceMessageType,
} from "../tool-area/CommandService";
import { Token } from "../../../shared/command-parser/token-stream";

/**
 * Creates a new Klive project
 */
export class NewProjectCommand extends CommandBase {
  readonly id = "new-project";
  readonly usage =
    "Usage: new-project <machine-id> [<root-folder>] <project-name>";

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage[]> {
    console.log(`Args: ${args.length}`);
    if (args.length !== 2 && args.length !== 3) {
      return [
        {
          type: TraceMessageType.Error,
          message: "Invalid number of arguments.",
        },
        ...this.usageMessage(),
      ];
    }
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(context: CommandContext): Promise<CommandResult> {
    return {
      success: true,
      finalMessage: "This command has been executed successfully.",
    };
  }
}
