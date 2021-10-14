import { getCommandService } from "@core/service-registry";
import { AddBreakpointCommand } from "./AddBreakpointCommand";
import { ClearBreakpointsCommand } from "./ClearBreakpointsCommand";
import { ListBreakpointsCommand } from "./ListBreakpointsCommand";
import { NewProjectCommand } from "./NewProjectCommand";
import { RemoveBreakpointCommand } from "./RemoveBreakpointCommand";

/**
 * This function registers all Klive commands used in the IDE
 */
export function registerKliveCommands(): void {
  getCommandService().registerCommand(new NewProjectCommand());
  getCommandService().registerCommand(new ListBreakpointsCommand());
  getCommandService().registerCommand(new AddBreakpointCommand());
  getCommandService().registerCommand(new RemoveBreakpointCommand());
  getCommandService().registerCommand(new ClearBreakpointsCommand());
}
