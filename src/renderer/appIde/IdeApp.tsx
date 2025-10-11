import { BackDrop } from "@controls/BackDrop";
import { SplitPanel } from "@controls/SplitPanel";
import { Toolbar } from "@controls/Toolbar";
import {
  getGlobalSetting,
  useDispatch,
  useGlobalSetting,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { activityRegistry, toolPanelRegistry } from "@renderer/registry";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import {
  EXPORT_CODE_DIALOG,
  NEW_PROJECT_DIALOG,
  EXCLUDED_PROJECT_ITEMS_DIALOG,
  FIRST_STARTUP_DIALOG_IDE
} from "@messaging/dialog-ids";
import {
  RequestMessage,
  NotReadyResponse,
  ResponseMessage,
  errorResponse
} from "@messaging/messages-core";
import {
  ideLoadedAction,
  setAudioSampleRateAction,
  selectActivityAction,
  setToolsAction,
  displayDialogAction,
  incProjectFileVersionAction
} from "@state/actions";
import { useRef, useEffect, useState, useLayoutEffect } from "react";
import { IIdeCommandService } from "../abstractions/IIdeCommandService";
import { ActivityBar } from "./ActivityBar/ActivityBar";
import {
  EraseAllBreakpointsCommand,
  ListBreakpointsCommand,
  SetBreakpointCommand,
  RemoveBreakpointCommand,
  EnableBreakpointCommand
} from "./commands/BreakpointCommands";
import {
  AddWatchpointCommand,
  RemoveWatchpointCommand,
  ListWatchpointsCommand,
  EraseAllWatchpointsCommand
} from "./commands/WatchpointCommands";
import { ClearHistoryCommand } from "./commands/ClearHistoryCommand";
import { ClearScreenCommand } from "./commands/ClearScreenCommand";
import { CloseFolderCommand } from "./commands/CloseFolderCommand";
import { DisassemblyCommand } from "./commands/DisassemblyCommand";
import {
  StartMachineCommand,
  PauseMachineCommand,
  StopMachineCommand,
  RestartMachineCommand,
  StartDebugMachineCommand,
  StepIntoMachineCommand,
  StepOverMachineCommand,
  StepOutMachineCommand
} from "./commands/MachineCommands";
import { NewProjectCommand } from "./commands/NewProjectCommand";
import { NumCommand } from "./commands/NumCommand";
import { OpenFolderCommand } from "./commands/OpenFolderCommand";
import { NewProjectDialog } from "./dialogs/NewProjectDialog";
import { DocumentArea } from "./DocumentArea/DocumentArea";
import { initializeMonaco } from "./DocumentPanels/MonacoEditor";
import { processMainToIdeMessages } from "./MainToIdeProcessor";
import { useAppServices } from "./services/AppServicesProvider";
import { SiteBar } from "./SideBar/SideBar";
import { IdeStatusBar } from "./StatusBar/IdeStatusBar";
import { ToolArea } from "./ToolArea/ToolArea";
import {
  CompileCommand,
  DebugCodeCommand,
  InjectCodeCommand,
  RunCodeCommand
} from "./commands/CompilerCommand";
import { NavigateToDocumentCommand } from "./commands/DocumentCommands";
import {
  HideDisassemblyCommand,
  HideMemoryCommand,
  SelectOutputPaneCommand,
  ShowDisassemblyCommand,
  ShowMemoryCommand
} from "./commands/ToolCommands";
import { ExportCodeDialog } from "./dialogs/ExportCodeDialog";
import { IdeEventsHandler } from "./IdeEventsHandler";
import { ExcludedProjectItemsDialog } from "./dialogs/ExcludedProjectItemsDialog";
import {
  ProjectExcludeItemsCommand,
  ProjectListExcludedItemsCommand
} from "./commands/ProjectExcludedItemsCommand";
import {
  ListSettingsCommand,
  MoveSettingsCommand,
  SettingCommand
} from "./commands/SettingCommands";
import { ResetZxbCommand } from "./commands/ZxbCommands";
import { FirstStartDialog } from "./dialogs/FirstStartDialog";
import { CreateDiskFileCommand } from "./commands/CreateDiskFileCommand";
import {
  CancelScriptCommand,
  DisplayScriptOutputCommand,
  RunBuildScriptCommand,
  RunScriptCommand
} from "./commands/ScriptCommands";
import {
  getCachedAppServices,
  getCachedStore,
  setCachedAppServices,
  setCachedStore
} from "../CachedServices";
import { ResetZ88DkCommand } from "./commands/Z88DkCommands";
import {
  ExportCodeCommand,
  KliveBuildCommand,
  KliveCompileCommand,
  KliveDebugCodeCommand,
  KliveInjectCodeCommand,
  KliveRunCodeCommand
} from "./commands/KliveCompilerCommands";
import { DisplayDialogCommand } from "./commands/DialogCommands";
import { setIsWindows } from "@renderer/os-utils";
import { ShellCommand } from "./commands/ShellCommand";
import { FullPanel } from "@renderer/controls/new/Panels";
import { createMainApi } from "@common/messaging/MainApi";
import { SetZ80RegisterCommand } from "./commands/SetZ80RegisterCommand";
import { SetMemoryContentCommand } from "./commands/SetMemoryContentCommand";
import { useMainApi } from "@renderer/core/MainApi";
import {
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_OPEN_LAST_PROJECT,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SHOW_STATUS_BAR,
  SETTING_IDE_SHOW_TOOLBAR,
  SETTING_IDE_SHOW_TOOLS,
  SETTING_IDE_SIDEBAR_TO_RIGHT,
  SETTING_IDE_SIDEBAR_WIDTH,
  SETTING_IDE_TOOLPANEL_HEIGHT,
  SETTING_IDE_TOOLS_ON_TOP
} from "@common/settings/setting-const";
import { ResetSjasmPlusCommand } from "./commands/SjasmPlusCommands";

const ipcRenderer = (window as any).electron.ipcRenderer;

const IdeApp = () => {
  // --- Used services
  const dispatch = useDispatch();
  const appServices = useAppServices();
  const mainApi = useMainApi();
  const { store, messenger } = useRendererContext();

  // --- Default document service instance
  if (!appServices.projectService.getActiveDocumentHubService()) {
    appServices.projectService.createDocumentHubService();
  }

  // --- Visual state
  const appPath = decodeURI(location.search.split("=")?.[1]);
  const ideLoaded = useSelector((s) => s.ideLoaded ?? false);
  const dimmed = useSelector((s) => s.dimMenu ?? false);
  const isWindows = useSelector((s) => s.isWindows ?? false);
  const showToolbar = useGlobalSetting(SETTING_IDE_SHOW_TOOLBAR);
  const showStatusBar = useGlobalSetting(SETTING_IDE_SHOW_STATUS_BAR);
  const showSideBar = useGlobalSetting(SETTING_IDE_SHOW_SIDEBAR);
  const sidebarToRight = useGlobalSetting(SETTING_IDE_SIDEBAR_TO_RIGHT);
  const showToolPanels = useGlobalSetting(SETTING_IDE_SHOW_TOOLS);
  const maximizeToolPanels = useGlobalSetting(SETTING_IDE_MAXIMIZE_TOOLS);
  const dialogId = useSelector((s) => s.ideView?.dialogToDisplay);
  const kliveProjectLoaded = useSelector((s) => s.project?.isKliveProject ?? false);
  const sideBarWidth = useGlobalSetting(SETTING_IDE_SIDEBAR_WIDTH);
  const toolPanelHeight = useGlobalSetting(SETTING_IDE_TOOLPANEL_HEIGHT);
  const toolPanelOnTop = useGlobalSetting(SETTING_IDE_TOOLS_ON_TOP);
  const [currentSidebarWidth, setCurrentSidebarWidth] = useState(sideBarWidth);
  const [currentToolPanelHeight, setCurrentToolPanelHeight] = useState(toolPanelHeight);

  // --- Use the current instance of the app services
  const mounted = useRef(false);

  useLayoutEffect(() => {
    console.log("AppPath", appPath);
    initializeMonaco(appPath);

    setCachedAppServices(appServices);
    setCachedStore(store);

    // --- Whenever each of these props are known, we can state the UI is loaded
    if (!appServices || !store || !messenger || mounted.current) return;

    // --- Run the app initialization sequence
    mounted.current = true;

    // --- Register the services to be used with the IDE
    registerCommands(appServices.ideCommandsService);

    // --- Set the audio sample rate to use
    const audioCtx = new AudioContext();
    const sampleRate = audioCtx.sampleRate;
    audioCtx.close();
    dispatch(setAudioSampleRateAction(sampleRate));

    // --- Set up the IDE state
    dispatch(selectActivityAction(activityRegistry[0].id));
    const regTools = toolPanelRegistry.map((t) => {
      return {
        id: t.id,
        name: t.name,
        visible: t.visible ?? true
      } as ToolInfo;
    });
    dispatch(setToolsAction(regTools));
    dispatch(ideLoadedAction());
  }, [appPath, appServices, store, messenger]);

  useEffect(() => {
    setIsWindows(isWindows);
  }, [isWindows]);

  useEffect(() => {
    console.log("IdeLoaded effect:", ideLoaded);
    if (ideLoaded) {
      (async () => {
        // --- Wait for global settings sync
        let counter = 0;
        while (counter < 100) {
          if (store.getState().ideStateSynched) break;
          counter++;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (counter >= 100) {
          console.error("Timeout while waiting for IDE settings sync");
          return;
        }

        console.log("Load IDE settings");
        const mainApi = createMainApi(messenger);
        const openLastProject = getGlobalSetting(store, SETTING_IDE_OPEN_LAST_PROJECT);
        if (openLastProject) {
          console.log("Query settings");
          const settings = await mainApi.getAppSettings();
          let projectPath = settings?.project?.folderPath;
          console.log("Project path:", projectPath);
          if (projectPath) {
            // --- Let's load the last propject
            projectPath = projectPath.replaceAll("\\", "/");
            console.log("Opening project");
            const result = await mainApi.openFolder(projectPath);
            if (result) {
              console.log("Opening project resulted in error:", result);
            } else {
              console.log("Project opened");
            }
          }
        }
      })();
    }
  }, [ideLoaded]);

  useLayoutEffect(() => {
    setCurrentSidebarWidth(sideBarWidth);
    setCurrentToolPanelHeight(toolPanelHeight);
  }, [sideBarWidth, toolPanelHeight]);

  return (
    <FullPanel id="appMain">
      <IdeEventsHandler />
      {showToolbar && <Toolbar ide={true} kliveProjectLoaded={kliveProjectLoaded} />}
      <FullPanel orientation="horizontal">
        <ActivityBar activities={activityRegistry} order={sidebarToRight ? 3 : 0} />
        <SplitPanel
          primaryLocation={sidebarToRight ? "right" : "left"}
          primaryVisible={showSideBar}
          initialPrimarySize={currentSidebarWidth}
          minSize={60}
          onPrimarySizeUpdateCompleted={(size: string) => {
            (async () => {
              await mainApi.setGlobalSettingsValue(SETTING_IDE_SIDEBAR_WIDTH, size);
              dispatch(incProjectFileVersionAction());
            })();
          }}
        >
          <SiteBar />
          <SplitPanel
            primaryLocation={toolPanelOnTop ? "top" : "bottom"}
            primaryVisible={showToolPanels}
            minSize={160}
            secondaryVisible={!maximizeToolPanels || !showToolPanels}
            initialPrimarySize={currentToolPanelHeight}
            onPrimarySizeUpdateCompleted={(size: string) => {
              (async () => {
                await mainApi.setGlobalSettingsValue(SETTING_IDE_TOOLPANEL_HEIGHT, size);
                dispatch(incProjectFileVersionAction());
              })();
            }}
          >
            <ToolArea siblingPosition={toolPanelOnTop ? "top" : "bottom"} />
            <DocumentArea />
          </SplitPanel>
        </SplitPanel>
      </FullPanel>
      <IdeStatusBar show={showStatusBar} />
      <BackDrop visible={dimmed} />

      {dialogId === NEW_PROJECT_DIALOG && (
        <NewProjectDialog
          onCreate={async () => {}}
          onClose={() => {
            store.dispatch(displayDialogAction());
          }}
        />
      )}
      {dialogId === EXPORT_CODE_DIALOG && (
        <ExportCodeDialog
          onExport={async () => {}}
          onClose={() => {
            store.dispatch(displayDialogAction());
          }}
        />
      )}
      {dialogId === EXCLUDED_PROJECT_ITEMS_DIALOG && (
        <ExcludedProjectItemsDialog
          onClose={() => {
            store.dispatch(displayDialogAction());
          }}
        />
      )}
      {dialogId === FIRST_STARTUP_DIALOG_IDE && (
        <FirstStartDialog
          onClose={() => {
            store.dispatch(displayDialogAction());
          }}
        />
      )}
    </FullPanel>
  );
};

export default IdeApp;

// --- This channel processes main requests and sends the results back
ipcRenderer.on("MainToIde", async (_ev, msg: RequestMessage) => {
  // --- Do not process messages coming while app services are not cached.
  if (!getCachedAppServices()) {
    ipcRenderer.send("MainToIdeResponse", {
      type: "NotReady"
    } as NotReadyResponse);
    return;
  }

  let response: ResponseMessage;
  try {
    response = await processMainToIdeMessages(msg, getCachedStore(), getCachedAppServices());
  } catch (err) {
    // --- In case of errors (rejected promises), retrieve an error response
    response = errorResponse(err.toString());
  }

  // --- Set the correlation ID to let the caller identify the response
  response.correlationId = msg.correlationId;
  response.sourceId = "ide";
  ipcRenderer.send("MainToIdeResponse", response);
});

// --- Register the interactive commands
let commandsRegistered = false;

function registerCommands(cmdSrv: IIdeCommandService): void {
  if (commandsRegistered) return;

  commandsRegistered = true;
  cmdSrv.registerCommand(new ClearScreenCommand());
  cmdSrv.registerCommand(new ClearHistoryCommand());
  cmdSrv.registerCommand(new StartMachineCommand());
  cmdSrv.registerCommand(new PauseMachineCommand());
  cmdSrv.registerCommand(new StopMachineCommand());
  cmdSrv.registerCommand(new RestartMachineCommand());
  cmdSrv.registerCommand(new StartDebugMachineCommand());
  cmdSrv.registerCommand(new StepIntoMachineCommand());
  cmdSrv.registerCommand(new StepOverMachineCommand());
  cmdSrv.registerCommand(new StepOutMachineCommand());

  cmdSrv.registerCommand(new NavigateToDocumentCommand());

  cmdSrv.registerCommand(new SelectOutputPaneCommand());
  cmdSrv.registerCommand(new ShowMemoryCommand());
  cmdSrv.registerCommand(new HideMemoryCommand());
  cmdSrv.registerCommand(new ShowDisassemblyCommand());
  cmdSrv.registerCommand(new HideDisassemblyCommand());

  cmdSrv.registerCommand(new EraseAllBreakpointsCommand());
  cmdSrv.registerCommand(new ListBreakpointsCommand());
  cmdSrv.registerCommand(new SetBreakpointCommand());
  cmdSrv.registerCommand(new RemoveBreakpointCommand());
  cmdSrv.registerCommand(new EnableBreakpointCommand());

  cmdSrv.registerCommand(new AddWatchpointCommand());
  cmdSrv.registerCommand(new RemoveWatchpointCommand());
  cmdSrv.registerCommand(new ListWatchpointsCommand());
  cmdSrv.registerCommand(new EraseAllWatchpointsCommand());

  cmdSrv.registerCommand(new NumCommand());
  cmdSrv.registerCommand(new ShellCommand());
  cmdSrv.registerCommand(new DisassemblyCommand());
  cmdSrv.registerCommand(new OpenFolderCommand());
  cmdSrv.registerCommand(new NewProjectCommand());
  cmdSrv.registerCommand(new CloseFolderCommand());

  cmdSrv.registerCommand(new KliveBuildCommand());
  cmdSrv.registerCommand(new KliveCompileCommand());
  cmdSrv.registerCommand(new KliveInjectCodeCommand());
  cmdSrv.registerCommand(new KliveRunCodeCommand());
  cmdSrv.registerCommand(new KliveDebugCodeCommand());

  cmdSrv.registerCommand(new CompileCommand());
  cmdSrv.registerCommand(new InjectCodeCommand());
  cmdSrv.registerCommand(new RunCodeCommand());
  cmdSrv.registerCommand(new DebugCodeCommand());
  cmdSrv.registerCommand(new ExportCodeCommand());

  cmdSrv.registerCommand(new ProjectListExcludedItemsCommand());
  cmdSrv.registerCommand(new ProjectExcludeItemsCommand());
  cmdSrv.registerCommand(new SettingCommand());
  cmdSrv.registerCommand(new ListSettingsCommand());
  cmdSrv.registerCommand(new MoveSettingsCommand());
  cmdSrv.registerCommand(new ResetZxbCommand());

  cmdSrv.registerCommand(new CreateDiskFileCommand());

  cmdSrv.registerCommand(new RunScriptCommand());
  cmdSrv.registerCommand(new RunBuildScriptCommand());
  cmdSrv.registerCommand(new CancelScriptCommand());
  cmdSrv.registerCommand(new DisplayScriptOutputCommand());

  cmdSrv.registerCommand(new ResetZ88DkCommand());
  cmdSrv.registerCommand(new DisplayDialogCommand());

  cmdSrv.registerCommand(new SetZ80RegisterCommand());
  cmdSrv.registerCommand(new SetMemoryContentCommand());

  cmdSrv.registerCommand(new ResetSjasmPlusCommand());
}
