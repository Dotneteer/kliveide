import { IMachineService } from "./IMachineService";
import { IIdeCommandService } from "./IIdeCommandService";
import { IOutputPaneService } from "./IOutputPaneService";
import { IProjectService } from "./IProjectService";
import { IUiService } from "@renderer/core/UiServices";
import { IValidationService } from "@renderer/core/ValidationService";

/**
 * This type defines the services the IDE provides
 */
export type AppServices = {
  uiService: IUiService;
  projectService: IProjectService;
  machineService: IMachineService;
  outputPaneService: IOutputPaneService;
  ideCommandsService: IIdeCommandService;
  validationService: IValidationService;
};
