import { ScriptRunInfo } from "@main/ksx-runner/ScriptManager";

/**
 * This interface represents the service that can manage scripts.
 */
export interface IScriptService {
  runScript(scriptFilePath: string): Promise<number>;
  cancelScript(scriptId: number): Promise<void>;
  getScriptsStatus(): Promise<ScriptRunInfo[]>;
  removeCompletedScripts(): Promise<void>;
  getScriptFileStatus(scriptFileName: string): ScriptRunInfo;
}
