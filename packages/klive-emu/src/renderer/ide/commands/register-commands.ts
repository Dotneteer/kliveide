import { commandService } from "../tool-area/CommandService";
import { NewProjectCommand } from "./NewProjectCommand";

/**
 * This function registers all Klive commands used in the IDE
 */
export function registerKliveCommands(): void {
  commandService.registerCommand(new NewProjectCommand());
}
