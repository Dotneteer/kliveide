import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  ensureBuildRootsLoaded,
  ensureProjectLoaded,
  ensureWorkspaceLoaded
} from "../IdeEventsHandler";
import {
  commandError,
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase
} from "../services/ide-commands";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { t } from "@common/i18n/i18n";

// --- Field names are the `argumentInfo` names: `extractArguments` stores each argument under its name
type NewProjectCommandArgs = {
  machineId: string;
  projectName: string;
  template?: string;
  "-p"?: string;
  "-o"?: boolean;
};

export class NewProjectCommand extends IdeCommandBase<NewProjectCommandArgs> {
  readonly id = "newp";
  get description() {
    return t("commands.newp.description");
  }
  readonly usage = "newp <machine ID> <project name> [<template>] [-p <project folder>] [-o]";
  readonly aliases = ["np"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "machineId" }, { name: "projectName" }],
    optional: [{ name: "template" }],
    namedOptions: [{ name: "-p" }],
    commandOptions: ["-o"]
  };

  async execute(
    context: IdeCommandContext,
    args: NewProjectCommandArgs
  ): Promise<IdeCommandResult> {
    const parts = args.machineId.split(":");
    const machineId = parts[0];
    const modelId = parts.length > 1 ? parts[1] : undefined;
    try {
      const responsePath = await context.mainApi.createKliveProject(
        machineId,
        args.projectName,
        args["-p"],
        modelId,
        args.template ?? "default"
      );
      if (args["-o"]) {
        const errorMessage = await context.mainApi.openFolder(responsePath);
        if (errorMessage) {
          return {
            success: false,
            finalMessage: t("commands.common.openFolderError", { message: errorMessage })
          };
        }
        await ensureProjectLoaded(context.service.projectService);
        await ensureWorkspaceLoaded(context.store);

        // --- The build root arrives through a separately forwarded action, so waiting for the
        // --- workspace above says nothing about whether it has landed yet. Give it a bounded
        // --- chance to arrive, exactly as the New Project dialog does.
        await ensureBuildRootsLoaded(context.store);

        // --- Navigate to the project root
        const buildRoots = context.store.getState().project?.buildRoots ?? [];
        if (buildRoots.length > 0) {
          context.service.ideCommandsService.executeCommand(`nav "${buildRoots[0]}"`);
        }
      }
      writeSuccessMessage(context.output, t("commands.newp.created", { path: responsePath }));
    } catch (error) {
      return commandError(error.toString());
    }
    return commandSuccess;
  }
}
