import { IOutputBuffer } from "@abstractions/output-pane-service";
import {
  InteractiveCommandContext,
  InteractiveCommandInfo,
  InteractiveCommandResult,
  IInteractiveCommandService,
} from "@abstractions/interactive-command-service";
import { parseCommand } from "./token-stream";

/**
 * This class is responsible to execute commands
 */
export class InteractiveCommandService implements IInteractiveCommandService {
  private readonly _commands = new Map<string, InteractiveCommandInfo>();

  /**
   * Registers a command
   * @param command Command to register
   */
  registerCommand(command: InteractiveCommandInfo): void {
    if (this._commands.has(command.id)) {
      throw new Error(
        `Command with ID ${command.id} has already been registered.`
      );
    }
    this._commands.set(command.id, command);
  }

  /**
   * Gets the information about the command with the specified ID
   * @param id Command identifier
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandInfo(id: string): InteractiveCommandInfo | undefined {
    return this._commands.get(id);
  }

  /**
   * Executes the specified command line
   * @param command Command to execute
   */
  async executeCommand(
    command: string,
    buffer: IOutputBuffer
  ): Promise<InteractiveCommandResult> {
    const tokens = parseCommand(command);
    if (tokens.length === 0) {
      // --- No token, no command to execute
      return {
        success: false,
        finalMessage: `The command '${command}' cannot be parsed.`,
      };
    }

    // --- Test if command is registered
    const commandId = tokens[0].text;
    const commandInfo = this._commands.get(tokens[0].text);
    if (!commandInfo) {
      return {
        success: false,
        finalMessage: `Unknown command '${commandId}'.`,
      };
    }

    // --- Execute the registered command
    const context: InteractiveCommandContext = {
      argTokens: tokens.slice(1),
      output: buffer,
    };
    return await commandInfo.execute(context);
  }
}
