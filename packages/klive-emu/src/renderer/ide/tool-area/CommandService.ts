import { IOutputBuffer } from "../../../shared/services/IOutputPaneService";
import { parseCommand } from "../../../shared/command-parser/token-stream";
import {
  CommandContext,
  CommandInfo,
  CommandResult,
  ICommandService,
} from "../../../shared/services/ICommandService";

/**
 * This class is responsible to execute commands
 */
export class CommandService implements ICommandService {
  private readonly _commands = new Map<string, CommandInfo>();

  /**
   * Registers a command
   * @param command Command to register
   */
  registerCommand(command: CommandInfo): void {
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
  getCommandInfo(id: string): CommandInfo | undefined {
    return this._commands.get(id);
  }

  /**
   * Executes the specified command line
   * @param command Command to execute
   */
  async executeCommand(
    command: string,
    buffer: IOutputBuffer
  ): Promise<CommandResult> {
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
    const context: CommandContext = {
      argTokens: tokens.slice(1),
      output: buffer,
    };
    return await commandInfo.execute(context);
  }
}
