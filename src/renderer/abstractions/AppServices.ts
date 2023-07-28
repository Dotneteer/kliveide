import { IMachineService } from "@/appEmu/abstrations/IMachineService";
import { IIdeCommandService } from "@/appIde/abstractions/IIdeCommandService";
import { IOutputPaneService } from "@/appIde/abstractions/IOutputPaneService";
import { IProjectService } from "@/appIde/abstractions/IProjectService";
import { IDocumentService } from "@/appIde/services/DocumentService";
import { IUiService } from "@/core/UiServices";

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
