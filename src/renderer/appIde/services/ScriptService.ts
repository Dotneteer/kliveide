import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IScriptService } from "@renderer/abstractions/IScriptService";
import { OutputContentLine } from "../ToolArea/abstractions";
import { ILiteEvent, LiteEvent } from "@emu/utils/lite-event";

class ScriptService implements IScriptService {
  private _scriptOutputs = new Map<number, OutputContentLine[]>();
  private _contentsChanged = new LiteEvent<number>();

  constructor (
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase
  ) {}

  /**
   * Starts the execution of the specified script.
   * @param scriptFilePath Script file path
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  async runScript (scriptFilePath: string): Promise<number> {
    const response = await this.messenger.sendMessage({
      type: "MainStartScript",
      filename: scriptFilePath
    });
    if (response.type === "ErrorResponse") {
      throw new Error(response.message);
    }
    if (response.type === "MainRunScriptResponse") {
      return response.id;
    }
    throw new Error("Unexpected response");
  }

  /**
   * Stops the execution of the specified script.
   * @param scriptId ID of the script to stop
   * @returns True, if the script is stopped; otherwise, false
   */
  async cancelScript (scriptId: number | string): Promise<boolean> {
    const response = await this.messenger.sendMessage({
      type: "MainStopScript",
      idOrFilename: scriptId
    });
    if (response.type === "ErrorResponse") {
      throw new Error(response.message);
    }
    if (response.type === "FlagResponse") {
      return response.flag;
    }
    throw new Error("Unexpected response");
  }

  /**
   * Gets the output of the specified script
   * @param scriptId Script ID
   */
  getScriptOutput (scriptId: number): OutputContentLine[] {
    return this._scriptOutputs.get(scriptId) ?? [];
  }

  /**
   * Add a new output line to the specified script
   * @param scriptId Script ID
   * @param prevLine Previous output line to override
   * @param currentLine New output line to add
   */
  addOutput (
    scriptId: number,
    prevLine: OutputContentLine | undefined,
    currentLine: OutputContentLine | undefined
  ) {
    let outputs = this._scriptOutputs.get(scriptId);
    if (!outputs) {
      outputs = [];
      this._scriptOutputs.set(scriptId, outputs);
    }
    if (prevLine && outputs.length > 0) {
      outputs[outputs.length - 1] = prevLine;
    }
    if (currentLine) {
      outputs.push(currentLine);
    }
  }

  /**
   * Raised when the contents of the output buffer have changed
   */
  contentsChanged (): ILiteEvent<number> {
    return this._contentsChanged;
  }
}

export const createScriptService = (
  store: Store<AppState>,
  messenger: MessengerBase
): IScriptService => new ScriptService(store, messenger);
