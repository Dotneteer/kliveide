import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import type { ILiteEvent } from "@abstractions/ILiteEvent";

import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IScriptService } from "@renderer/abstractions/IScriptService";
import { LiteEvent } from "@emu/utils/lite-event";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { createMainApi } from "@common/messaging/MainApi";
import { createEmuApi } from "@common/messaging/EmuApi";

class ScriptService implements IScriptService {
  private _scriptOutputs = new Map<number, OutputPaneBuffer>();
  private _contentsChanged = new LiteEvent<number>();

  constructor(
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase
  ) {}

  /**
   * Gets the ID of the latest script with the specified file path.
   * @param scriptFilePath Script file path
   */
  getLatestScriptId(scriptFilePath: string): number {
    const scripts = this.store.getState().scripts.slice().reverse();
    const script = scripts.find((s) => s.scriptFileName === scriptFilePath);
    return script ? script.id : -1;
  }

  /**
   * Starts the execution of the specified script.
   * @param scriptFilePath Script file path
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  async runScript(scriptFilePath: string): Promise<number> {
    const scriptInfo = await createMainApi(this.messenger).startScript(scriptFilePath);
    if (scriptInfo.hasParseError) {
      throw new Error("The script contains parse errors. See the Script Output pane for details.");
    }

    // --- Create a new output buffer for the script
    if (scriptInfo.id > 0) {
      const buffer = new OutputPaneBuffer();
      this._scriptOutputs.set(scriptInfo.id, buffer);
    }

    // --- Check the target
    if (scriptInfo.target !== "emu") {
      // --- Script runs in the main process, nothing to do
      return scriptInfo.id;
    }

    // --- Script runs in the emulator, we need to forward the output
    createEmuApi(this.messenger).startScript(
      scriptInfo.id,
      scriptFilePath,
      scriptInfo.contents
    );
    return scriptInfo.id;
  }

  /**
   * Starts the execution of the script specified with the given text.
   * @param scriptText The text of the script to run
   * @param scriptFunction The script function to run
   * @param filename The file name of the script
   * @param speciality The speciality of the script
   * @returns The script ID of the started script.
   */
  async runScriptText(
    scriptText: string,
    scriptFunction: string,
    filename: string,
    speciality: string
  ): Promise<number> {
    console.log("Running script text", scriptText);
    const scriptInfo = await createMainApi(this.messenger).startScript(
      filename,
      scriptFunction,
      scriptText,
      speciality
    );
    if (scriptInfo.hasParseError) {
      throw new Error("The script contains parse errors.");
    }

    // --- Create a new output buffer for the script
    const buffer = new OutputPaneBuffer();
    this._scriptOutputs.set(scriptInfo.id, buffer);
    return scriptInfo.id;
  }

  /**
   * Stops the execution of the specified script.
   * @param idOrFileName ID of the script to stop
   * @returns True, if the script is stopped; otherwise, false
   */
  async cancelScript(idOrFileName: number | string): Promise<boolean> {
    // --- Obtain the script status information
    let script: ScriptRunInfo;
    const state = this.store.getState();
    const projectFolder = state.project?.folderPath;
    const scripts = state.scripts;
    if (typeof idOrFileName === "number") {
      script = scripts.find((s) => s.id === idOrFileName);
    } else {
      const reversed = scripts.slice().reverse();
      script = reversed.find((s) => s.scriptFileName === `${projectFolder}/${idOrFileName}`);
    }

    // --- If the script is not found or already stopped, we're done.
    if (!script) {
      return false;
    }

    // --- Is it an emulator script?
    if (script.runsInEmu) {
      // --- Script runs in the emulator, we need to forward the output
      await createEmuApi(this.messenger).stopScript(script.id);
    }

    // --- Send the stop script message
    return await createMainApi(this.messenger).stopScript(script.id);
  }

  /**
   * Gets the output of the specified script
   * @param scriptId Script ID
   */
  getScriptOutputBuffer(scriptId: number): OutputPaneBuffer | undefined {
    return this._scriptOutputs.get(scriptId);
  }

  /**
   * Raised when the contents of the output buffer have changed
   */
  contentsChanged(): ILiteEvent<number> {
    return this._contentsChanged;
  }
}

export const createScriptService = (
  store: Store<AppState>,
  messenger: MessengerBase
): IScriptService => new ScriptService(store, messenger);
