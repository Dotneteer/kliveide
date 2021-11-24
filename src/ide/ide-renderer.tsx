import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { applyMiddleware, combineReducers, createStore } from "redux";
import { Provider } from "react-redux";
import { IpcRendereApi } from "../exposed-apis";
import { registerThemes } from "@components/register-themes";
import {
  CODE_RUNNER_SERVICE,
  COMMAND_SERVICE,
  CONTEXT_MENU_SERVICE,
  DIALOG_SERVICE,
  dispatch,
  DOCUMENT_SERVICE,
  getCommandService,
  getDocumentService,
  getModalDialogService,
  getOutputPaneService,
  getSideBarService,
  getState,
  getStore,
  getToolAreaService,
  INTERACTIVE_PANE_SERVICE,
  MODAL_DIALOG_SERVICE,
  OUTPUT_PANE_SERVICE,
  PROJECT_SERVICE,
  registerService,
  SETTIINGS_SERVICE,
  SIDE_BAR_SERVICE,
  STORE_SERVICE,
  THEME_SERVICE,
  TOOL_AREA_SERVICE,
} from "@core/service-registry";
import { KliveStore } from "@state/KliveStore";
import { RendererToMainStateForwarder } from "@components/RendererToMainStateForwarder";
import { KliveAction } from "@state/state-core";
import { appReducers } from "@state/app-reducers";
import { AppState, getInitialAppState } from "@state/AppState";
import { ForwardActionRequest } from "@core/messaging/message-types";
import { ThemeService } from "@themes/theme-service";
import { ModalDialogService } from "@services/modal-service";
import { registerSite } from "@abstractions/process-site";
import { registerCommonCommands } from "@abstractions/common-commands";
import { registerIdeToEmuMessenger } from "@core/messaging/message-sending";
import { registerCommand, startCommandStatusQuery } from "@abstractions/command-registry";
import { DialogService } from "@services/dialog-service";
import { CodeRunnerService } from "@modules-core/CodeRunnerService";
import IdeApp from "./IdeApp";
import { SideBarService } from "../common-ui/services/SideBarService";
import { ProjectService } from "./explorer-tools/ProjectService";
import { ContextMenuService } from "./context-menu/ContextMenuService";
import { DocumentService } from "./document-area/DocumentService";
import { InteractivePaneService } from "./tool-area/InteractiveService";
import { OutputPaneService } from "./tool-area/OutputPaneService";
import { ToolAreaService } from "./tool-area/ToolAreaService";
import { InteractiveCommandService } from "./tool-area/InteractiveCommandService";
import { IdeToEmuMessenger } from "./IdeToEmuMessenger";
import { Activity, ACTIVITY_DEBUG_ID, ACTIVITY_FILE_ID, ACTIVITY_LOG_ID, ACTIVITY_SETTINGS_ID, ACTIVITY_TEST_ID } from "@abstractions/activity";
import { changeActivityAction, setActivitiesAction } from "@core/state/activity-bar-reducer";
import { ProjectFilesPanelDescriptor } from "./explorer-tools/ProjectFilesPanel";
import { Z80RegistersPanelDescriptor } from "@modules/cpu-z80/Z80RegistersPanel";
import { UlaInformationPanelDescriptor } from "@modules/vm-zx-spectrum/UlaInformationPanel";
import { BlinkInformationPanelDescriptor } from "@modules/vm-z88/BlinkInformationPanel";
import { Z80DisassemblyPanelDescriptor } from "@modules/cpu-z80/Z80DisassemblyPanel";
import { MemoryPanelDescriptor } from "@modules/cpu-z80/Z80MemoryPanel";
import { CallStackPanelDescriptor } from "./side-bar/CallStackPanel";
import { BreakpointsPanelDescriptor } from "./side-bar/BreakpointsPanel";
import { IoLogsPanelDescription } from "./side-bar/IoLogsPanel";
import { TestRunnerPanelDescription } from "./test-tools/TestRunnerPanel";
import { OutputToolPanelDescriptor } from "./tool-area/OutputToolPanel";
import { VmOutputPanelDescriptor } from "./side-bar/VmOutputPane";
import { CompilerOutputPanelDescriptor } from "./tool-area/CompilerOutputPane";
import { InteractiveToolPanelDescriptor } from "./tool-area/InteractiveToolPanel";
import { asmkZ80LanguageProvider } from "./languages/asm-z80-provider";
import { mpmZ80LanguageProvider } from "./languages/mpm-z80-provider";
import { virtualMachineToolsService } from "@modules-core/virtual-machine-tool";
import { ZxSpectrum48CustomDisassembler } from "@modules/vm-zx-spectrum/ZxSpectrum48CustomDisassembler";
import { CambridgeZ88CustomDisassembler } from "@modules/vm-z88/CambridgeZ88CustomDisassembler";
import { newProjectDialog, NEW_PROJECT_DIALOG_ID } from "./explorer-tools/NewProjectDialog";
import { newFolderDialog, NEW_FOLDER_DIALOG_ID } from "./explorer-tools/NewFolderDialog";
import { newFileDialog, NEW_FILE_DIALOG_ID } from "./explorer-tools/NewFileDialog";
import { renameFileDialog, RENAME_FILE_DIALOG_ID } from "./explorer-tools/RenameFileDialog";
import { renameFolderDialog, RENAME_FOLDER_DIALOG_ID } from "./explorer-tools/RenameFolderDialog";
import { registerKliveCommands } from "./commands/register-commands";
import { SettingsService } from "./settings-service/settings-service";
import { ResetZxbCommand } from "@modules/integration-zxb/ResetZxbCommand";

// ------------------------------------------------------------------------------
// Initialize the forwarder that sends application state changes to the main
// process to keep the same state in each process

// --- Electron APIs exposed for the renderer process
const ipcRenderer = (window as any).ipcRenderer as IpcRendereApi;

// --- This instance forwards renderer actions to the main process
const forwarder = new RendererToMainStateForwarder("ide");

// Indicates if we're in forwarding mode
let isForwarding = false;

// --- This middleware function forwards the action originated in the main process
// --- to the renderer processes of browser windows.
const forwardToMainMiddleware = () => (next: any) => (action: KliveAction) => {
  if (!isForwarding) {
    forwarder.forwardAction(action);
  }
  return next(action);
};

const appReducer = combineReducers(appReducers);
const rootReducer = (state: AppState, action: KliveAction) => {
  if (action.type === "IDE_SYNC") {
    return appReducer({ ...action.payload.appState } as any, action);
  }
  return appReducer(state as any, action);
};

// ------------------------------------------------------------------------------
// --- Sign we are in the emulator renderer process

registerSite("ide");
registerCommonCommands();

// ------------------------------------------------------------------------------
// --- Register the main services

// --- Register the store service
registerService(
  STORE_SERVICE,
  new KliveStore(
    createStore(
      rootReducer,
      getInitialAppState(),
      applyMiddleware(forwardToMainMiddleware)
    )
  )
);

// --- Register additional services
registerService(THEME_SERVICE, new ThemeService());
registerService(MODAL_DIALOG_SERVICE, new ModalDialogService());
registerService(SIDE_BAR_SERVICE, new SideBarService());
registerService(PROJECT_SERVICE, new ProjectService());
registerService(CONTEXT_MENU_SERVICE, new ContextMenuService());
registerService(DOCUMENT_SERVICE, new DocumentService());
registerService(INTERACTIVE_PANE_SERVICE, new InteractivePaneService());
registerService(OUTPUT_PANE_SERVICE, new OutputPaneService());
registerService(TOOL_AREA_SERVICE, new ToolAreaService());
registerService(COMMAND_SERVICE, new InteractiveCommandService());
registerService(DIALOG_SERVICE, new DialogService());
registerService(CODE_RUNNER_SERVICE, new CodeRunnerService());
registerService(SETTIINGS_SERVICE, new SettingsService());

// --- Register meesenger objects
registerIdeToEmuMessenger(new IdeToEmuMessenger());

// --- Prepare the themes used in this app
registerThemes(getState().isWindows ?? false);

      // --- Set up activities
      const activities: Activity[] = [
        {
          id: ACTIVITY_FILE_ID,
          title: "Explorer",
          iconName: "files",
        },
        {
          id: ACTIVITY_DEBUG_ID,
          title: "Debug",
          iconName: "debug-alt",
          commands: [
            {
              commandId: "klive.startVm",
            },
            {
              commandId: "klive.debugVm",
            },
            {
              commandId: "klive.pauseVm",
            },
            {
              commandId: "klive.stopVm",
            },
            {
              commandId: "klive.stepIntoVm",
            },
            {
              commandId: "klive.stepOverVm",
            },
            {
              commandId: "klive.stepOutVm",
            },
          ],
        },
        {
          id: ACTIVITY_LOG_ID,
          title: "Machine logs",
          iconName: "output",
        },
        {
          id: ACTIVITY_TEST_ID,
          title: "Testing",
          iconName: "beaker",
        },
        {
          id: ACTIVITY_SETTINGS_ID,
          title: "Manage",
          iconName: "settings-gear",
          isSystemActivity: true,
        },
      ];
      dispatch(setActivitiesAction(activities));

      // --- Register side bar panels
      const sideBarService = getSideBarService();

      // (Explorer)
      sideBarService.registerSideBarPanel(
        "file-view",
        new ProjectFilesPanelDescriptor()
      );

      // (Run and Debug)
      sideBarService.registerSideBarPanel(
        "debug-view",
        new Z80RegistersPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new UlaInformationPanelDescriptor(),
        ["sp48", "sp128"]
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new BlinkInformationPanelDescriptor(),
        ["cz88"]
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new Z80DisassemblyPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new MemoryPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new CallStackPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new BreakpointsPanelDescriptor()
      );

      // (Machine logs)
      sideBarService.registerSideBarPanel(
        "log-view",
        new IoLogsPanelDescription()
      );

      // (Testing)
      sideBarService.registerSideBarPanel(
        "test-view",
        new TestRunnerPanelDescription()
      );

      // --- Register tool panels
      const toolAreaService = getToolAreaService();
      toolAreaService.registerTool(new OutputToolPanelDescriptor(), false);
      const outputPaneService = getOutputPaneService();
      outputPaneService.registerOutputPane(new VmOutputPanelDescriptor());
      outputPaneService.registerOutputPane(new CompilerOutputPanelDescriptor());
      toolAreaService.registerTool(new InteractiveToolPanelDescriptor(), true);

      // --- Register custom languages
      const documentService = getDocumentService();
      documentService.registerCustomLanguage(asmkZ80LanguageProvider);
      documentService.registerCustomLanguage(mpmZ80LanguageProvider);

      // --- Register document panels and editors
      documentService.registerCodeEditor(".project", {
        language: "json",
      });
      documentService.registerCodeEditor(".asm.kz80", {
        language: "asm-kz80",
        allowBuildRoot: true,
      });
      documentService.registerCodeEditor(".mpm.z80", {
        language: "mpm-z80",
      });

      // --- Register virtual machine tools
      virtualMachineToolsService.registerTools(
        "sp48",
        new ZxSpectrum48CustomDisassembler()
      );
      virtualMachineToolsService.registerTools(
        "cz88",
        new CambridgeZ88CustomDisassembler()
      );

      // --- Register modal dialogs
      const modalDialogService = getModalDialogService();
      modalDialogService.registerModalDescriptor(
        NEW_PROJECT_DIALOG_ID,
        newProjectDialog
      );
      modalDialogService.registerModalDescriptor(
        NEW_FOLDER_DIALOG_ID,
        newFolderDialog
      );
      modalDialogService.registerModalDescriptor(
        NEW_FILE_DIALOG_ID,
        newFileDialog
      );
      modalDialogService.registerModalDescriptor(
        RENAME_FILE_DIALOG_ID,
        renameFileDialog
      );
      modalDialogService.registerModalDescriptor(
        RENAME_FOLDER_DIALOG_ID,
        renameFolderDialog
      );

      // --- Register available commands
      registerKliveCommands();

      // --- Register integration commands
      getCommandService().registerCommand(new ResetZxbCommand());

      // --- Select the file-view activity
      dispatch(changeActivityAction(0));


ipcRenderer.on("RendererStateRequest", (_ev, msg: ForwardActionRequest) => {
  isForwarding = true;
  try {
    dispatch(msg.action);
  } finally {
    isForwarding = false;
  }
});

// --- Start idle command status refresh
startCommandStatusQuery();

ReactDOM.render(
  <Provider store={getStore().store}>
    <IdeApp />
  </Provider>,
  document.getElementById("app")
);
