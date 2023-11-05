import { MessengerBase } from "@common/messaging/MessengerBase";
import { reportMessagingError } from "@renderer/reportError";

  // --- Saves the current project
export const saveProject = async (messenger: MessengerBase, delay = 1000) => {
  await new Promise(r => setTimeout(r, delay));
  const response = await messenger.sendMessage({ type: "MainSaveProject" });
  if (response.type === "ErrorResponse") {
    reportMessagingError(`MainSaveProject request failed: ${response.message}`);
  }
};
