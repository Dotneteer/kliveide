import { IMachineService } from "@/renderer/abstractions/IMachineService";
import { IIdeCommandService } from "@/renderer/abstractions/IIdeCommandService";
import { IOutputPaneService } from "@/renderer/abstractions/IOutputPaneService";
import { IProjectService } from "@/renderer/abstractions/IProjectService";
import { IDocumentService } from "@/renderer/appIde/services/DocumentService";
import { IUiService } from "@/renderer/core/UiServices";

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
};
