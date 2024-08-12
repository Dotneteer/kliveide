import type { IdeExecuteCommandResponse } from "@messaging/any-to-ide";

import { getIdeApi } from "@messaging/MainToIdeMessenger";

export async function executeIdeCommand (
  scriptId: number,  
  commandText: string
): Promise<IdeExecuteCommandResponse> {
  return await getIdeApi().executeCommand(commandText, scriptId);
}
