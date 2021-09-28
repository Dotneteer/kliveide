import { Token, TokenType } from "../../../shared/command-parser/token-stream";
import { ideToEmuMessenger } from "../IdeToEmuMessenger";
import {
  CreateKliveProjectResponse,
  GetRegisteredMachinesResponse,
} from "../../../shared/messaging/message-types";
import { CommandBase, CommandResult, TraceMessage, TraceMessageType } from "../../../shared/services/ICommandService";

/**
 * Creates a new Klive project
 */
export class NewProjectCommand extends CommandBase {
  readonly id = "new-project";
  readonly usage =
    "Usage: new-project <machine-id> [<root-folder>] <project-name>";

  // --- Command argument placeholders
  private _machineTypeArg: string;
  private _rootFolderArg: string | null;
  private _projectFolderArg: string;

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    // --- Check argument number
    if (args.length !== 2 && args.length !== 3) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }

    // --- Check virtual machine type
    const machines = (
      await ideToEmuMessenger.sendMessage<GetRegisteredMachinesResponse>({
        type: "GetRegisteredMachines",
      })
    ).machines;
    this._machineTypeArg = args[0].text;
    if (!machines.map(m => m.id).includes(this._machineTypeArg)) {
      return {
        type: TraceMessageType.Error,
        message: `Cannot find machine with ID '${this._machineTypeArg}'. Available machine types are: ${machines}`,
      };
    }

    // --- Check 2nd argument
    this._rootFolderArg = args[1].text;
    console.log(args[1]);
    if (
      args[1].type !== TokenType.Identifier &&
      args[1].type !== TokenType.Path
    ) {
      return {
        type: TraceMessageType.Error,
        message: `Invalid argument: ${this._rootFolderArg}`,
      };
    }

    // --- Check 3rd argument
    if (args.length < 3) {
      // --- Path is the folder
      this._projectFolderArg = this._rootFolderArg;
      this._rootFolderArg = null;
    } else {
      this._projectFolderArg = args[2].text;
      if (
        args[2].type !== TokenType.Identifier &&
        args[2].type !== TokenType.Path
      ) {
        return {
          type: TraceMessageType.Error,
          message: `Invalid argument: ${this._projectFolderArg}`,
        };
      }
    }
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(): Promise<CommandResult> {
    const operation =
      await ideToEmuMessenger.sendMessage<CreateKliveProjectResponse>({
        type: "CreateKliveProject",
        machineType: this._machineTypeArg,
        rootFolder: this._rootFolderArg,
        projectFolder: this._projectFolderArg,
      });
    return {
      success: !operation.error,
      finalMessage: operation.error
        ? operation.error
        : `Klive project '${operation.targetFolder}' successfully created.`,
    };
  }
}
