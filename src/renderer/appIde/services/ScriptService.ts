import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IScriptService } from "@renderer/abstractions/IScriptService";
import { ILiteEvent, LiteEvent } from "@emu/utils/lite-event";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";

class ScriptService implements IScriptService {
  private _scriptOutputs = new Map<number, OutputPaneBuffer>();
  private _contentsChanged = new LiteEvent<number>();

  constructor (
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase
  ) {}

  /**
   * Gets the ID of the latest script with the specified file path.
   * @param scriptFilePath Script file path
   */
  getLatestScriptId (scriptFilePath: string): number {
    const scripts = this.store.getState().scripts.slice().reverse();
    console.log(scripts);
    const script = scripts.find(s => s.scriptFileName === scriptFilePath);
    return script ? script.id : -1;
  }

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
      // --- Create a new output buffer for the script
      if (response.id > 0) {
        const buffer = new OutputPaneBuffer();
        this._scriptOutputs.set(response.id, buffer);
        console.log("Init buffer", response.id);
      }
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
  getScriptOutputBuffer (scriptId: number): OutputPaneBuffer | undefined {
    return this._scriptOutputs.get(scriptId);
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
