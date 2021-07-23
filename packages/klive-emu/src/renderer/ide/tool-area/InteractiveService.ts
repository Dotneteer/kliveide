import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";
import { IOutputBuffer, OutputPaneBuffer } from "./OutputPaneService";

const MAX_HISTORY = 1024;

/**
 * This class implements the functionality of the interactive pane service
 */
class InteractivePaneService {
  private _outputBuffer: IOutputBuffer = new OutputPaneBuffer();
  private _outputContentChanged = new LiteEvent<void>();
  private _history: string[] = [];
  private _commandSubmitted = new LiteEvent<string>();
  private _commandExecuting = false;
  private _commandExecuted = new LiteEvent<string>();

  /**
   * Gets the output buffer
   * @returns The output buffer
   */
  getOutputBuffer(): IOutputBuffer {
    return this._outputBuffer;
  }

  /**
   * Clears the command history
   */
  clearHistory(): void {
    this._history = [];
  }

  /**
   * Adds a new command to the history
   * @param command The command to add to the history
   */
  appendHistory(command: string) {
    this._history.push(command);
    if (this._history.length > MAX_HISTORY) {
      this._history = this._history.slice(1);
    }
  }

  /**
   * Gets a command from the history
   * @param index The index from the end the command history
   * @returns The command from the history
   */
  getCommandFromHistory(index: number): string {
    return index > this._history.length
      ? ""
      : this._history[this._history.length - index - 1];
  }

  /**
   * Submits a command
   * @param command Command string
   */
  submitCommand(command: string): void {
    if (command.replace(/\s/g, "").length) {
      this.appendHistory(command);
      this._commandExecuting = true;
      this._commandSubmitted.fire(command);
    }
  }

  /**
   * Gets the flag that indicates if a command is being executed
   * @returns Command execution flag
   */
  isCommandExecuting(): boolean {
    return this._commandExecuting;
  }

  /**
   * Signs that the last submitted command has been completed
   */
  signCommandExecuted(): void {
    if (this._commandExecuting) {
      this._commandExecuting = false;
      this._commandExecuted.fire(this._history[this._history.length - 1]);
    }
  }

  /**
   * Fires when to contents of the output within the interactive pane changes
   */
  get outputContentChanged(): ILiteEvent<void> {
    return this._outputContentChanged;
  }

  /**
   * Fires when a command has been submitted
   */
  get commandSubmitted(): ILiteEvent<string> {
    return this._commandSubmitted;
  }

  /**
   * Fires when a command has been executed
   */
  get commandExecuted(): ILiteEvent<string> {
    return this._commandExecuted;
  }
}

/**
 * Te singleton instance of the output pane service
 */
export const interactivePaneService = new InteractivePaneService();
