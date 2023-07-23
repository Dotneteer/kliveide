import { AppServices } from "@/abstractions/AppServices";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IIdeCommandService } from "../abstractions/IIdeCommandService";
import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandInfo } from "../abstractions/IdeCommandInfo";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import { ValidationMessage } from "../abstractions/ValidationMessage";
import { ValidationMessageType } from "../abstractions/ValidationMessageType";
import { IOutputBuffer } from "../ToolArea/abstractions";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { parseCommand, Token } from "./command-parser";
import { IdeCommandBase } from "./ide-commands";

const MAX_HISTORY = 1024;

class IdeCommandService implements IIdeCommandService {
  private readonly _commands: IdeCommandInfo[] = [];
  private readonly _buffer = new OutputPaneBuffer();
  private _history: string[] = [];
  private _appServices: AppServices;

  /**
   * Initializes the interactive command registry
   */
  constructor (
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase
  ) {
    this.registerCommand(new HelpCommand());
  }

  /**
   * Gets the command with the specified index from the command history
   * @param index Command index
   */
  getCommandFromHistory (index: number): string {
    return this._history[index];
  }

  /**
   * Gets the length of the command history
   */
  getCommandHistoryLength (): number {
    return this._history?.length ?? 0;
  }

  /**
   * Clears the command history
   */
  clearHistory (): void {
    this._history.length = 0;
  }

  /**
   * Sets the app services instance
   * @param appServices AppServices instance to use with commands
   */
  setAppServices (appServices: AppServices): void {
    this._appServices = appServices;
  }

  /**
   * Registers a command
   * @param command Command to register
   */
  registerCommand (command: IdeCommandInfo): void {
    if (this.getCommandInfo(command.id)) {
      throw new Error(
        `Command with ID ${command.id} has already been registered.`
      );
    }
    this._commands.push(command);
  }

  /**
   * Retrieves all registered commands
   */
  getRegisteredCommands (): IdeCommandInfo[] {
    return this._commands.slice(0);
  }

  /**
   * Gets the information about the command with the specified ID
   * @param id Command identifier
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandInfo (id: string): IdeCommandInfo | undefined {
    return this._commands.find(c => c.id === id);
  }

  /**
   * Gets the information about the command with the specified ID or alias
   * @param idOrAlias
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandByIdOrAlias (idOrAlias: string): IdeCommandInfo | undefined {
    return this._commands.find(
      c =>
        c.id === idOrAlias ||
        (c.aliases && c.aliases.some(a => a === idOrAlias))
    );
  }

  /**
   * Executes the specified command line
   * @param command Command to execute
   */
  async executeInteractiveCommand (
    command: string,
    buffer?: IOutputBuffer,
    useHistory = true
  ): Promise<IdeCommandResult> {
    // --- Create a buffer if that does not exists
    buffer ??= new OutputPaneBuffer();

    // --- Add command to history
    if (useHistory) {
      this._history.push(command);
      if (this._history.length > MAX_HISTORY) {
        this._history = this._history.slice(1);
      }
    }

    // --- Command must be syntactically valid
    const tokens = parseCommand(command);
    if (tokens.length === 0) {
      // --- No token, no command to execute
      return {
        success: false,
        finalMessage: `The command '${command}' cannot be parsed.`
      };
    }

    // --- Test if command is registered
    const commandId = tokens[0].text;
    const commandInfo = this.getCommandByIdOrAlias(tokens[0].text);
    if (!commandInfo) {
      const finalMessage = `Unknown command '${commandId}'.`;
      buffer.color("bright-red");
      buffer.writeLine(finalMessage);
      buffer.resetStyle();
      return {
        success: false,
        finalMessage
      };
    }

    // --- Execute the registered command
    const context: IdeCommandContext = {
      commandtext: command,
      store: this.store,
      argTokens: tokens.slice(1),
      output: buffer,
      service: this._appServices,
      messenger: this.messenger
    };
    const commandResult = await commandInfo.execute(context);
    if (commandResult.success) {
      if (commandResult.finalMessage) {
        buffer.color("bright-green");
        buffer.writeLine(commandResult.finalMessage);
        buffer.resetStyle();        
      }
    } else {
      buffer.color("bright-red");
      buffer.writeLine(
        commandResult.finalMessage ?? "Command execution failed."
      );
      buffer.resetStyle();
    }
    return commandResult;
  }

  /**
   * Executes the specified command line
   * @param command Command to execute
   * @param buffer Optional output buffer
   */
  executeCommand (
    command: string,
    buffer?: IOutputBuffer
  ): Promise<IdeCommandResult> {
    return this.executeInteractiveCommand(command, buffer, false);
  }

  /**
   * Displays the specified trace messages
   * @param messages Trace messages to display
   * @param context Context to display the messages in
   */
  displayTraceMessages (
    messages: ValidationMessage[],
    context: IdeCommandContext
  ): void {
    for (var trace of messages) {
      context.output.color(
        trace.type === ValidationMessageType.Error
          ? "bright-red"
          : trace.type === ValidationMessageType.Warning
          ? "yellow"
          : "bright-blue"
      );
      context.output.writeLine(trace.message);
    }
  }

  /**
   * Gets the output buffer of the interactive commands
   */
  getBuffer (): IOutputBuffer {
    return this._buffer;
  }

  /**
   * Displays a navigation action to the specified project file
   * @param context Context to display the messages in
   * @param file Filename
   * @param line Optional line number
   * @param column Optional column number
   */
  writeNavigationAction (context: IdeCommandContext, file: string, line?: number, column?: number): void {
    context.output.write(
      `${file}${line != undefined ?` (${line}:${column + 1})` : ""}`,
      async () => {
        await this.executeCommand(
          `nav ${file} ${line != undefined ? line : ""} ${
            column != undefined ? (column + 1).toString() : ""
          }`
        );
      },
      true
    );
  }
}

class HelpCommand extends IdeCommandBase {
  private _arg: string | null = null;

  readonly id = "help";
  readonly description = "Displays help information about commands";
  readonly usage = "help [<command>]";
  readonly aliases = ["?", "-?", "-h"];

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs (
    args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
    // --- Check argument number
    if (args.length > 1) {
      return {
        type: ValidationMessageType.Error,
        message: "Invalid number of arguments."
      };
    }
    this._arg = args.length ? args[0].text : null;
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    let count = 0;
    const cmdSrv = context.service.ideCommandsService;
    const selectedCommands: IdeCommandInfo[] = this._arg
      ? cmdSrv
          .getRegisteredCommands()
          .filter(
            cmd =>
              cmd.id.toLowerCase().includes(this._arg.toLowerCase()) ||
              cmd.aliases.some(a =>
                a.toLowerCase().includes(this._arg.toLowerCase())
              )
          )
      : cmdSrv.getRegisteredCommands();
    const out = context.output;
    out.color("bright-blue");
    out.writeLine("Available interactive commands:");
    out.writeLine();
    selectedCommands
      .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))
      .forEach(ci => {
        out.color("bright-magenta");
        out.bold(true);
        out.write(`${ci.id}`);
        out.bold(false);
        if ((ci.aliases ?? []).length > 0) {
          out.write(` (${ci.aliases.join(", ")})`);
        }
        context.output.color("bright-blue");
        context.output.write(`: `);
        context.output.writeLine(ci.description);
        if (ci.usage) {
          context.output.writeLine(`  usage: ${ci.usage}`);
        }
        count++;
      });
    return {
      success: true,
      finalMessage: `${count} command${count > 1 ? "s" : ""} displayed.`
    };
  }
}

/**
 * Creates an interactive commands service instance
 * @param dispatch Dispatch function to use
 * @returns Interactive commands service instance
 */
export function createInteractiveCommandsService (
  store: Store<AppState>,
  messenger: MessengerBase
) {
  return new IdeCommandService(store, messenger);
}
