import { getCommandService } from "@abstractions/service-helpers";
import { NewProjectCommand } from "./NewProjectCommand";

/**
 * This function registers all Klive commands used in the IDE
 */
export function registerKliveCommands(): void {
  getCommandService().registerCommand(new NewProjectCommand());
}
