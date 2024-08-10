import type { IMachineService } from "./IMachineService";
import type { IIdeCommandService } from "./IIdeCommandService";
import type { IOutputPaneService } from "./IOutputPaneService";
import type { IProjectService } from "./IProjectService";
import type { IUiService } from "@renderer/core/UiServices";
import type { IValidationService } from "@renderer/core/ValidationService";
import type { IScriptService } from "./IScriptService";

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
  scriptService: IScriptService;
};
