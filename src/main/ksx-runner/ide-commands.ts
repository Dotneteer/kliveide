import type { IdeExecuteCommandResponse } from "@messaging/any-to-ide";

import { sendFromMainToIde } from "@messaging/MainToIdeMessenger";

export async function executeIdeCommand (
  scriptId: number,  
  commandText: string
): Promise<IdeExecuteCommandResponse> {
  const response = await sendFromMainToIde<IdeExecuteCommandResponse>({
    type: "IdeExecuteCommand",
    commandText,
    scriptId
  });
  return response;
}
