import { IMachineService } from "@/appEmu/abstrations/IMachineService";
import { IInteractiveCommandService } from "@/appIde/abstractions/IInteractiveCommandService";
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
  interactiveCommandsService: IInteractiveCommandService;
  projectService: IProjectService;
};
