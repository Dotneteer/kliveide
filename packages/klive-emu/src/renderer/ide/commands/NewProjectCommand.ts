import {
  CommandBase,
  CommandContext,
  CommandResult,
  TraceMessage,
  TraceMessageType,
} from "../tool-area/CommandService";
import { Token } from "../../../shared/command-parser/token-stream";
import { ideToEmuMessenger } from "../IdeToEmuMessenger";
import { GetRegisteredMachinesResponse } from "../../../shared/messaging/message-types";

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
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
      console.log(args);
    if (args.length !== 2 && args.length !== 3) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }
    const machines = (
      await ideToEmuMessenger.sendMessage<GetRegisteredMachinesResponse>({
        type: "GetRegisteredMachines",
      })
    ).machines;
    const machineType = args[0].text;
    if (!machines.includes(machineType)) {
      return {
        type: TraceMessageType.Error,
        message: `Cannot find machine with ID '${machineType}'. Available machine types are: ${machines}`,
      };
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
