import { IMachineService } from "./IMachineService";
import { IIdeCommandService } from "./IIdeCommandService";
import { IOutputPaneService } from "./IOutputPaneService";
import { IProjectService } from "./IProjectService";
import { IDocumentService } from "@appIde/services/DocumentService";
import { IUiService } from "@renderer/core/UiServices";
import { IValidationService } from "@renderer/core/ValidationService";

/**
 * This type defines the services the IDE provides
 */
export type AppServices = {
  uiService: IUiService;
  documentService: IDocumentService;
  machineService: IMachineService;
  outputPaneService: IOutputPaneService;
  ideCommandsService: IIdeCommandService;
  projectService: IProjectService;
  validationService: IValidationService;
  documentHub: IDocumentService;
  setDocumentHub?: (hub: IDocumentService) => void;
};
