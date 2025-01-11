import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  commandError,
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase
} from "../services/ide-commands";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

type NewProjectCommandArgs = {
  machineId: string;
  projectName: string;
  templateId?: string;
  projectFolder?: string;
  "-o"?: boolean;
};

export class NewProjectCommand extends IdeCommandBase<NewProjectCommandArgs> {
  readonly id = "newp";
  readonly description = "Creates a new Klive project.";
  readonly usage = "newp <machine ID> <project name> [<template>] [<project folder>]";
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
        args.templateId ?? "default"
      );
      if (args["-o"]) {
        const errorMessage = await context.mainApi.openFolder(responsePath);
        if (errorMessage) {
          return {
            success: false,
            finalMessage: `Error opening folder: ${errorMessage}`
          };
        }
        writeSuccessMessage(
          context.output,
          `Klive project successfully created in ${responsePath}`
        );
      }
    } catch (error) {
      return commandError(error.toString());
    }
    return commandSuccess;
  }
}
