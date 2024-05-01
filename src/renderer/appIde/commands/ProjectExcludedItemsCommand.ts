import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError,
  writeInfoMessage,
  writeMessage,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";
import { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import {
  ExcludedItemInfo,
  excludedItemsFromGlobalSettingsAsync,
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

export class ProjectListExcludedItemsCommand extends IdeCommandBase {
  readonly id = "project:excluded-items";
  readonly description = "Lists the paths of items currently excluded from the project.";
  readonly usage = "project:excluded-items [--global]";
  readonly aliases = ["project:list-excluded", "proj:excluded-items", "proj:list-excluded", "p:lx"];

  globalMode = false;

  async validateArgs(context: IdeCommandContext): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length > 1) {
      return validationError("This command expects one argument at most.");
    }
    this.globalMode = args.length === 1 && context.argTokens.some((t) => t.text === "--global");
    if (args.length === 1 && !this.globalMode) {
      return validationError(`Unexpected arguments! Usage: ${this.usage}`);
    }
    return [];
  }

  async doExecute(context: IdeCommandContext): Promise<IdeCommandResult> {
    let result: Promise<ExcludedItemInfo[]>;
    if (this.globalMode) {
      result = excludedItemsFromGlobalSettingsAsync(context.messenger);
    } else {
      const proj = context.store.getState().project;
      if (!proj?.isKliveProject) {
        return commandError("Please, open the project first!");
      }

      result = Promise.resolve(excludedItemsFromProject(proj));
    }
    const items = await result;
    if (items.length <= 0) {
      writeInfoMessage(context.output, "There are no excluded items.");
    } else {
      writeInfoMessage(context.output, "Excluded items:");
      items.forEach((t) =>
        writeInfoMessage(context.output, `"  "}${t.value}`)
      );
    }
    return commandSuccess;
  }
}

export class ProjectExcludeItemsCommand extends IdeCommandBase {
  readonly id = "project:exclude-item";
  readonly description = "Exclude/restore an item to project or globally.";
  readonly usage = "project:exclude-item [--global] [-d] <item-path>...";
  readonly aliases = ["project:exclude", "proj:exclude-item", "proj:exclude", "p:x"];

  globalMode: boolean;
  deleteMode: boolean;
  paths: string[];

  prepareCommand(): void {
    this.globalMode = false;
    this.deleteMode = false;
    this.paths = [];
  }

  async validateArgs(context: IdeCommandContext): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length <= 0) {
      return validationError("This command expects at least one argument.");
    }
    for (const tok of args) {
      switch (tok.text) {
        case "--global":
          this.globalMode = true;
          break;
        case "-d":
          this.deleteMode = true;
          break;
        default:
          this.paths.push(tok.text);
      }
    }
    if (!this.deleteMode && this.paths.length <= 0) {
      return validationError("Specify at least one item path to work with.");
    }
    return [];
  }

  async doExecute(context: IdeCommandContext): Promise<IdeCommandResult> {
    let needSaveProject = false;
    if (this.globalMode) {
      // System-wide operation
      if (this.deleteMode) {
        // Remove some entries from system-wide exclusion list
        if (this.paths.length > 0) {
          const excludedItemsPromise = excludedItemsFromGlobalSettingsAsync(context.messenger).then(
            (items) => items.map((t) => t.id)
          );
          this.paths = this.paths.map((t) => t.replace(getIsWindows() ? "\\" : "/", "/"));
          await context.messenger.sendMessage({
            type: "MainSetGloballyExcludedProjectItems",
            files: (await excludedItemsPromise)?.filter(
              (p) => !this.paths.some((t) => t.localeCompare(p) === 0)
            )
          });
        } else {
          await context.messenger.sendMessage({
            type: "MainSetGloballyExcludedProjectItems",
            files: []
          });
        }
      } else {
        // Add new entries to system-wide exclusion list
        const filteredPaths: string[] = [];
        for (let p of this.paths) {
          if (!p || p.length <= 0) continue;
          if (!context.service.validationService.isValidPath(p)) {
            writeMessage(context.output, `${p} is not a valid path`, "red");
            continue;
          }

          filteredPaths.push(p);
        }
        needSaveProject = beforeExcluded(context, filteredPaths);
        await context.messenger.sendMessage({
          type: "MainAddGloballyExcludedProjectItems",
          files: filteredPaths
        });
      }
      await context.messenger.sendMessage({ type: "MainSaveSettings" });
    } else {
      // Project-specific operation
      const proj = context.store.getState().project;
      if (!proj?.isKliveProject) {
        return commandError("Please, open the project first!");
      }

      const disp = (a: any) => context.store.dispatch(a, context.messageSource);
      if (this.deleteMode) {
        // Remove some entries from project-specific exclusion list
        if (this.paths.length > 0) {
          this.paths = this.paths.map((t) => t.replace(getIsWindows() ? "\\" : "/", "/"));
          const filteredPaths = proj.excludedItems?.filter(
            (p) => !this.paths.some((t) => t.localeCompare(p) === 0)
          );
          disp(setExcludedProjectItemsAction(filteredPaths));
        } else {
          disp(setExcludedProjectItemsAction([]));
        }
      } else {
        // Add new entries to project-specific exclusion list
        const filteredPaths: string[] = [];
        for (let p of this.paths) {
          if (!p || p.length <= 0) continue;
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
