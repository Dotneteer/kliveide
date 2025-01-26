import { getIdeAltApi } from "@messaging/MainToIdeMessenger";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

export async function executeIdeCommand(
  scriptId: number,
  commandText: string
): Promise<IdeCommandResult> {
  return await getIdeAltApi().executeCommand(commandText, scriptId);
}
