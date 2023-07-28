import { IMachineService } from "@/renderer/appEmu/abstrations/IMachineService";
import { IIdeCommandService } from "@/renderer/appIde/abstractions/IIdeCommandService";
import { IOutputPaneService } from "@/renderer/appIde/abstractions/IOutputPaneService";
import { IProjectService } from "@/renderer/appIde/abstractions/IProjectService";
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
