import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IScriptService } from "@renderer/abstractions/IScriptService";

class ScriptService implements IScriptService {
  constructor (
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase
  ) {}

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
}

export const createScriptService = (
  store: Store<AppState>,
  messenger: MessengerBase
): IScriptService => new ScriptService(store, messenger);
