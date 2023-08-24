import { MessengerBase } from "@common/messaging/MessengerBase";
import { reportMessagingError } from "@renderer/reportError";

  // --- Saves the current project
export const saveProject = async (messenger: MessengerBase) => {
  await new Promise(r => setTimeout(r, 1000));
  const response = await messenger.sendMessage({ type: "MainSaveProject" });
  if (response.type === "ErrorResponse") {
    reportMessagingError(`MainSaveProject request failed: ${response.message}`);
  }
};
