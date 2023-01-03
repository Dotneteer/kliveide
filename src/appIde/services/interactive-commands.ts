import { InteractiveCommandInfo, InteractiveCommandContext, InteractiveCommandResult, TraceMessageType, TraceMessage } from "../abstractions";
import { Token } from "./command-parser";

/**
 * IInteractiveCommandService is responsible for keeping a registry of
 * commands that can be executed in the Interactive window pane.
 */
export abstract class InteractiveCommandBase implements InteractiveCommandInfo {
  /**
   * The unique identifier of the command
   */
  abstract readonly id: string;

  /**
   * Represents the usage of a command
   */
  abstract readonly usage: string | string[];

  /**
   * Concise explanation of the command
   */
  abstract readonly description: string;

  /**
   * Command aliases;
   */
  readonly aliases?: string[] = [];

  /**
   * Executes the command within the specified context
   */
  async execute(
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    // --- Validate the arguments and display potential issues
    const received = await this.validateArgs(context.argTokens);
    const validationMessages = Array.isArray(received) ? received : [received];
    const hasError = validationMessages.some(
      m => m.type === TraceMessageType.Error
    );
    if (hasError) {
      validationMessages.push(...this.usageMessage());
    }
    context.service.displayTraceMessages(validationMessages, context);
    if (hasError) {
      // --- Sign validation error
      return {
        success: false
      };
    }

    // --- Now, it's time to execute the command
    return this.doExecute(context);
  }

  /**
   * Executes the command after argument validation
   * @param context Command execution context
   */
  async doExecute(
    _context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    return {
      success: true,
      finalMessage: "This command has been executed successfully."
    };
  }

  /**
   * Validates the input arguments
   * @param _args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(_args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    return [];
  }

  /**
   * Retrieves the usage message
   * @returns
   */
  usageMessage(): TraceMessage[] {
    const usage = this.usage;
    const messages = typeof usage === "string" ? [usage] : usage;
    const renderedMessages: TraceMessage[] = [];
    renderedMessages.push(<TraceMessage>{
      type: TraceMessageType.Info,
      message: this.description
    });
    if (messages.length > 0) {
      renderedMessages.push(<TraceMessage>{
        type: TraceMessageType.Info,
        message: `Usage: ${messages[0]}`
      });
      messages.slice(1).forEach(m =>
        renderedMessages.push(<TraceMessage>{
          type: TraceMessageType.Info,
          message: m
        })
      );
    }
    if (this.aliases && this.aliases.length > 0) {
      renderedMessages.push(<TraceMessage>{
        type: TraceMessageType.Info,
        message: `${
          this.aliases.length === 1 ? "Alias" : "Aliases"
        }: ${this.aliases.map(a => getAlias(a)).join(", ")}`
      });
    }
    return renderedMessages;

    function getAlias(alias: string): string {
      return alias;
    }
  }
}
