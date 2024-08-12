import { getAllMachineModels } from "@common/machines/machine-registry";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import {
  IdeCommandBase,
  validationError,
  commandError,
  writeSuccessMessage,
  commandSuccess
} from "../services/ide-commands";

export class NewProjectCommand extends IdeCommandBase {
  readonly id = "newp";
  readonly description = "Creates a new Klive project.";
  readonly usage = "newp <machine ID> <project name> [<template>] [<project folder>]";
  readonly aliases = ["np"];

  private machineId: string;
  private modelId: string;
  private projectName: string;
  private templateId: string;
  private projectFolder: string;

  prepareCommand(): void {
    delete this.machineId;
    delete this.modelId;
    delete this.templateId;
    delete this.projectName;
    delete this.projectFolder;
  }

  async validateArgs(context: IdeCommandContext): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length !== 2 && args.length !== 3) {
      return validationError("This command must use 2 to 4 arguments");
    }

    // --- Extract machine ID
    const [machineId, modelId] = args[0].text.split(":");
    const machineTypes = getAllMachineModels();
    if (!machineTypes.find((mt) => mt.machineId === machineId)) {
      return validationError(`Cannot find machine type '${machineId}'`);
    }
    this.machineId = machineId;
    if (
      modelId &&
      !machineTypes.find((mt) => mt.machineId === machineId && mt.modelId === modelId)
    ) {
      return validationError(`Cannot find model type '${modelId}' for machine '${machineId}`);
    }
    this.modelId = modelId;

    // --- Extract project name
    this.projectName = args[1].text;
    if (args.length > 2) {
      this.templateId = args[2].text;
      if (args.length > 3) {
        this.projectFolder = args[3].text;
      }
    }
    return [];
  }

  async doExecute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const response = await context.mainApi.createKliveProject(
      this.machineId,
      this.projectName,
      this.projectFolder,
      this.modelId,
      this.templateId ?? "default"
    );
    if (response.errorMessage) {
      return commandError(response.errorMessage);
    }
    writeSuccessMessage(context.output, `Klive project successfully created in ${response.path}`);
    return commandSuccess;
  }
}
