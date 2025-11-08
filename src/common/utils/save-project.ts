import { createMainApi } from "@messaging/MainApi";
import { MessengerBase } from "@messaging/MessengerBase";

  // --- Saves the current project
export const saveProject = async (messenger: MessengerBase, delay = 1000) => {
  await new Promise(r => setTimeout(r, delay));
  await createMainApi(messenger).saveProject();
};
