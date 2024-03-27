/**
 * This interface represents the service that can manage scripts.
 */
export interface IScriptService {
  runScript(scriptFilePath: string): Promise<number>;
  cancelScript(scriptId: number | string): Promise<boolean>;
}
