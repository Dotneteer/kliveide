import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  writeInfoMessage,
  writeMessage,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";
import {
  ExcludedItemInfo,
  getExcludedProjectItemsFromGlobalSettings,
  excludedItemsFromProject
} from "../utils/excluded-items-utils";
import {
  addExcludedProjectItemsAction,
  setBuildRootAction,
  setExcludedProjectItemsAction
} from "@common/state/actions";
import { saveProject } from "../utils/save-project";
import { pathStartsWith } from "@common/utils/path-utils";
import { getIsWindows } from "@renderer/os-utils";
import { isAbsolutePath } from "../project/project-node";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

type ListExcludedItemArgs = {
  "-global"?: boolean;
};

export class ProjectListExcludedItemsCommand extends IdeCommandBase<ListExcludedItemArgs> {
  readonly id = "project:excluded-items";
  readonly description = "Lists the paths of items currently excluded from the project.";
  readonly usage = "project:excluded-items [-global]";
  readonly aliases = ["project:list-excluded", "proj:excluded-items", "proj:list-excluded", "p:lx"];

  readonly argumentInfo: CommandArgumentInfo = {
    commandOptions: ["-global"]
  };

  async execute(context: IdeCommandContext, args: ListExcludedItemArgs): Promise<IdeCommandResult> {
    let result: ExcludedItemInfo[];
    if (args["-global"]) {
      result = await getExcludedProjectItemsFromGlobalSettings(context.messenger);
    } else {
      const proj = context.store.getState().project;
      result = excludedItemsFromProject(proj);
    }

    console.log("result", result);
    if (result.length <= 0) {
      writeInfoMessage(context.output, "There are no excluded items.");
    } else {
      writeInfoMessage(context.output, "Excluded items:");
      result.forEach((t) => writeInfoMessage(context.output, `${t.value}`));
    }
    return commandSuccess;
  }
}

type ExcludeItemArgs = {
  "-global"?: boolean;
  "-d"?: boolean;
  itemPath: string;
  rest: string[];
};

export class ProjectExcludeItemsCommand extends IdeCommandBase<ExcludeItemArgs> {
  readonly id = "project:exclude-item";
  readonly description = "Exclude/restore an item to project or globally.";
  readonly usage = "project:exclude-item [-global] [-d] <item-path>...";
  readonly aliases = ["project:exclude", "proj:exclude-item", "proj:exclude", "p:x"];

  readonly argumentInfo: CommandArgumentInfo = {
    allowRest: true,
    commandOptions: ["-global", "-d"]
  };

  async execute(context: IdeCommandContext, args: ExcludeItemArgs): Promise<IdeCommandResult> {
    let needSaveProject = false;
    if (args["-global"]) {
      // System-wide operation
      if (args["-d"]) {
        // Remove some entries from system-wide exclusion list
        if (args.rest.length > 0) {
          const excludedItems = await getExcludedProjectItemsFromGlobalSettings(context.messenger);
          args.rest = args.rest.map((t) => t.replace(getIsWindows() ? "\\" : "/", "/"));
          await context.mainApiAlt.setGloballyExcludedProjectItems(
            excludedItems
              .map((item) => item.value)
              ?.filter((p) => !args.rest.some((t) => t.localeCompare(p) === 0))
          );
        } else {
          await context.mainApiAlt.setGloballyExcludedProjectItems([]);
        }
      } else {
        // Add new entries to system-wide exclusion list
        const filteredPaths: string[] = [];
        for (const p of args.rest) {
          if (!p?.length) continue;
          if (!context.service.validationService.isValidPath(p)) {
            writeMessage(context.output, `${p} is not a valid path`, "red");
            continue;
          }

          filteredPaths.push(p);
        }
        needSaveProject = beforeExcluded(context, filteredPaths);
        await context.mainApiAlt.addGlobalExcludedProjectItem(filteredPaths);
      }
      await context.mainApiAlt.saveSettings();
    } else {
      // Project-specific operation
      const proj = context.store.getState().project;
      if (!proj?.isKliveProject) {
        return commandError("Please, open the project first!");
      }

      const disp = (a: any) => context.store.dispatch(a, context.messageSource);
      if (args["-d"]) {
        // Remove some entries from project-specific exclusion list
        if (args.rest.length > 0) {
          args.rest = args.rest.map((t) => t.replace(getIsWindows() ? "\\" : "/", "/"));
          const filteredPaths = proj.excludedItems?.filter(
            (p) => !args.rest.some((t) => t.localeCompare(p) === 0)
          );
          disp(setExcludedProjectItemsAction(filteredPaths));
        } else {
          disp(setExcludedProjectItemsAction([]));
        }
      } else {
        // Add new entries to project-specific exclusion list
        const filteredPaths: string[] = [];
        for (let p of args.rest) {
          if (!p?.length) continue;
          if (!context.service.validationService.isValidPath(p)) {
            writeMessage(context.output, `${p} is not a valid path`, "red");
            continue;
          }
          filteredPaths.push(p);
        }
        beforeExcluded(context, filteredPaths);
        disp(addExcludedProjectItemsAction(filteredPaths));
      }
      needSaveProject = true;
    }

    writeSuccessMessage(context.output, "Done.");
    if (needSaveProject) await saveProject(context.messenger);

    return commandSuccess;
  }
}

function beforeExcluded(context: IdeCommandContext, items: string[]): boolean {
  let result = false;

  const state = context.store.getState();
  const proj = state.project;
  if (proj?.isKliveProject === true) {
    const root = proj.folderPath;
    items = items.map((t) => (isAbsolutePath(t) ? t : `${root}/${t})`));

    const buildRoots = proj.buildRoots?.filter(
      (b) => !items.some((t) => pathStartsWith(`${root}/${b})`, t))
    );
    if (buildRoots && buildRoots.length < proj.buildRoots.length) {
      context.store.dispatch(setBuildRootAction(buildRoots, true), context.messageSource);
      result = true;
    }
  }

  const documentHubService = context.service.projectService.getActiveDocumentHubService();
  documentHubService
    .getOpenDocuments()
    ?.filter((doc) => items.some((t) => pathStartsWith(doc.id, t)))
    .forEach((doc) => documentHubService.closeDocument(doc.id));

  return result;
}
