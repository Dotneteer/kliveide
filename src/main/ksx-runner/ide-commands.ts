import { sendFromMainToIde } from "../../common/messaging/MainToIdeMessenger";
import { IdeExecuteCommandResponse } from "../../common/messaging/any-to-ide";

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
