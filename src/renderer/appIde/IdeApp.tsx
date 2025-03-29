import { BackDrop } from "@controls/BackDrop";
import { SplitPanel } from "@controls/SplitPanel";
import { Toolbar } from "@controls/Toolbar";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
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
  activateToolAction,
  displayDialogAction
} from "@state/actions";
import { useRef, useEffect } from "react";
import { IIdeCommandService } from "../abstractions/IIdeCommandService";
import { ActivityBar } from "./ActivityBar/ActivityBar";
import {
  EraseAllBreakpointsCommand,
  ListBreakpointsCommand,
  SetBreakpointCommand,
  RemoveBreakpointCommand,
  EnableBreakpointCommand
} from "./commands/BreakpointCommands";
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
import { DOCS_WORKSPACE } from "./DocumentArea/DocumentsHeader";
import { CODE_EDITOR } from "@common/state/common-ids";
import { delay } from "@renderer/utils/timing";

const ipcRenderer = (window as any).electron.ipcRenderer;

const IdeApp = () => {
  // --- Used services
  const dispatch = useDispatch();
  const appServices = useAppServices();
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
  const showToolbar = useSelector((s) => s.ideViewOptions.showToolbar);
  const showStatusBar = useSelector((s) => s.ideViewOptions.showStatusBar);
  const showSideBar = useSelector((s) => s.ideViewOptions.showSidebar);
  const showToolPanels = useSelector((s) => s.ideViewOptions.showToolPanels);
  const maximizeToolPanels = useSelector((s) => s.ideViewOptions.maximizeTools);
  const dialogId = useSelector((s) => s.ideView?.dialogToDisplay);
  const kliveProjectLoaded = useSelector((s) => s.project?.isKliveProject ?? false);

  const activityOrder = useSelector((s) => s.ideViewOptions.primaryBarOnRight) ? 3 : 0;
  const primaryBarsPos = useSelector((s) => s.ideViewOptions.primaryBarOnRight) ? "right" : "left";
  const docPanelsPos = useSelector((s) => s.ideViewOptions.toolPanelsOnTop) ? "top" : "bottom";

  // --- Use the current instance of the app services
  const mounted = useRef(false);
  useEffect(() => {
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
    dispatch(activateToolAction(regTools.find((t) => t.visible ?? true).id));

    // --- Sign that the UI is ready
    dispatch(ideLoadedAction());
  }, [appPath, appServices, store, messenger]);

  useEffect(() => {
    setIsWindows(isWindows);
  }, [isWindows]);

  useEffect(() => {
    console.log("IdeLoaded effect:", ideLoaded);
    if (ideLoaded) {
      (async () => {
        console.log("Load IDE settings")
        let state = store.getState();
        const mainApi = createMainApi(messenger);
        if (!state.ideSettings.disableAutoOpenProject) {
          console.log("Query settings");
          const settings = await mainApi.getAppSettings();
          console.log("IDE settings:", JSON.stringify(settings?.ideSettings))
          let projectPath = settings?.project?.folderPath;
          console.log("Project path:", projectPath)
          if (!(settings?.ideSettings?.disableAutoOpenProject ?? false) && projectPath) {
            // --- Let's load the last propject
            projectPath = projectPath.replaceAll("\\", "/");
            console.log("Opening project");
            await mainApi.openFolder(projectPath);
            console.log("Project opened");
            state = store.getState();

            // --- Wait up to 10 seconds for the project to be opened
            console.log("Waiting for the end of project loading")
            let count = 0;
            while (count < 100) {
              if (store.getState().project?.folderPath === projectPath) break;
              count++;
              await delay(100);
            }
            if (count >= 100) {
              console.error("Timeout while opening the last project");
              return;
            }

            // --- Open the last documents
            console.log("Time to open project workdspace");
            const lastOpenDocs = (
              state.workspaceSettings?.[DOCS_WORKSPACE]?.documents ?? []
            ).filter((d: { type: string; }) => d.type === CODE_EDITOR);
            const activeDocId = state.workspaceSettings?.[DOCS_WORKSPACE]?.activeDocumentId;
            let activeDocCommand = "";
            for (const doc of lastOpenDocs) {
              console.log("Document:", JSON.stringify(doc))
              if (doc.id.startsWith(projectPath)) {
                const navigateToId = doc.id.substring(projectPath.length + 1);
                const line = doc.position?.line ?? 0;
                const column = (doc.position?.column ?? 0) + 1;
                const command = `nav "${navigateToId}" ${line} ${column}`;
                console.log(command);
                await appServices.ideCommandsService.executeCommand(command);
                if (doc.id === activeDocId) {
                  activeDocCommand = command;
                }
              }
            }

            // --- Navigate to the active document
            console.log("Navigate to the active document");
            if (activeDocCommand) {
              await appServices.ideCommandsService.executeCommand(activeDocCommand);
            }
            console.log("Project workspace opened");
          }
        }
      })();
    }
  }, [ideLoaded]);

  return (
    <FullPanel id="appMain">
      <IdeEventsHandler />
      {showToolbar && <Toolbar ide={true} kliveProjectLoaded={kliveProjectLoaded} />}
      <FullPanel orientation="horizontal">
        <ActivityBar activities={activityRegistry} order={activityOrder} />
        <SplitPanel
          primaryLocation={primaryBarsPos}
          primaryVisible={showSideBar}
          initialPrimarySize="25%"
          minSize={60}
        >
          <SiteBar />
          <SplitPanel
            primaryLocation={docPanelsPos}
            primaryVisible={showToolPanels}
            minSize={160}
            secondaryVisible={!maximizeToolPanels}
            initialPrimarySize="33%"
          >
            <ToolArea siblingPosition={docPanelsPos} />
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
}
