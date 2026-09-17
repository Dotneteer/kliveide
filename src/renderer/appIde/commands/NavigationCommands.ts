import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import {
  IdeCommandBase,
  commandSuccess,
  commandSuccessWith,
  writeInfoMessage,
  writeMessage
} from "../services/ide-commands";

/*
 * Go Back / Go Forward over the navigation history.
 *
 * Having nowhere to go is not an error: these run from shortcuts and toolbar buttons, where a
 * failure dialog for "already at the oldest location" would be noise.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §5.
 */

export class NavigateBackCommand extends IdeCommandBase {
  readonly id = "nav-back";
  readonly description = "Goes back to the previous location in the navigation history";
  readonly usage = "nav-back";
  readonly aliases = ["nb"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const moved = await context.service.navigationHistoryService.goBack();
    return moved ? commandSuccess : commandSuccessWith("No location to go back to.");
  }
}

export class NavigateForwardCommand extends IdeCommandBase {
  readonly id = "nav-forward";
  readonly description = "Goes forward to the next location in the navigation history";
  readonly usage = "nav-forward";
  readonly aliases = ["nf"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const moved = await context.service.navigationHistoryService.goForward();
    return moved ? commandSuccess : commandSuccessWith("No location to go forward to.");
  }
}

export class NavigationHistoryCommand extends IdeCommandBase {
  readonly id = "nav-history";
  readonly description = "Lists the navigation history, newest first; '>' marks the current location";
  readonly usage = "nav-history";
  readonly aliases = ["nh"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const history = context.service.navigationHistoryService;
    const { entries, index } = history.getEntries();
    if (entries.length === 0) {
      writeInfoMessage(context.output, "The navigation history is empty.");
      return commandSuccess;
    }
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const position = history.describe(entry);
      const marker = i === index ? ">" : " ";
      writeMessage(
        context.output,
        `${marker} ${i}: ${entry.title}${position ? ` (${position})` : ""} [${entry.reason}]`,
        i === index ? "bright-cyan" : undefined
      );
    }
    return commandSuccess;
  }
}

export class ClearNavigationHistoryCommand extends IdeCommandBase {
  readonly id = "nav-clear";
  readonly description = "Clears the navigation history";
  readonly usage = "nav-clear";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.service.navigationHistoryService.clear();
    return commandSuccessWith("Navigation history cleared.");
  }
}
