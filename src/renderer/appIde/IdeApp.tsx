import { AppServices } from "@renderer/abstractions/AppServices";
import { BackDrop } from "@controls/BackDrop";
import { SplitPanel } from "@controls/SplitPanel";
import { Toolbar } from "@controls/Toolbar";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { activityRegistry, toolPanelRegistry } from "@renderer/registry";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import {
  EXPORT_CODE_DIALOG,
  NEW_PROJECT_DIALOG,
  EXCLUDED_PROJECT_ITEMS_DIALOG
} from "@messaging/dialog-ids";
import {
  RequestMessage,
  NotReadyResponse,
  ResponseMessage,
  errorResponse
} from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import {
  ideLoadedAction,
  setAudioSampleRateAction,
  selectActivityAction,
  setToolsAction,
  activateToolAction,
  closeAllDocumentsAction,
  displayDialogAction
} from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import styles from "@styles/app.module.scss";
import { ipcRenderer } from "electron";
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
import { CompileCommand, DebugCodeCommand, ExportCodeCommand, InjectCodeCommand, RunCodeCommand } from "./commands/CompilerCommand";
import { NavigateToDocumentCommand } from "./commands/DocumentCommands";
import { SelectOutputPaneCommand } from "./commands/ToolCommands";
import { ExportCodeDialog } from "./dialogs/ExportCodeDialog";
import { IdeEventsHandler } from "./IdeEventsHandler";
import { ExcludedProjectItemsDialog } from "./dialogs/ExcludedProjectItemsDialog";
import { ProjectExcludeItemsCommand, ProjectListExcludedItemsCommand } from "./commands/ProjectExcludedItemsCommand";

// --- Store the singleton instances we use for message processing (out of React)
let appServicesCached: AppServices;
let messengerCached: MessengerBase;
let storeCached: Store<AppState>;

const IdeApp = () => {
  // --- Used services
  const dispatch = useDispatch();
  const appServices = useAppServices();
  const { store, messenger } = useRendererContext();

  // --- Visual state
  const appPath = useSelector(s => s.appPath);
  const dimmed = useSelector(s => s.dimMenu ?? false);
  const showToolbar = useSelector(s => s.ideViewOptions.showToolbar);
  const showStatusBar = useSelector(s => s.ideViewOptions.showStatusBar);
  const showSideBar = useSelector(s => s.ideViewOptions.showSidebar);
  const showToolPanels = useSelector(s => s.ideViewOptions.showToolPanels);
  const maximizeToolPanels = useSelector(s => s.ideViewOptions.maximizeTools);
  const dialogId = useSelector(s => s.ideView?.dialogToDisplay);

  const activityOrder = useSelector(s => s.ideViewOptions.primaryBarOnRight)
    ? 3
    : 0;
  const primaryBarsPos = useSelector(s => s.ideViewOptions.primaryBarOnRight)
    ? "right"
    : "left";
  const docPanelsPos = useSelector(s => s.ideViewOptions.toolPanelsOnTop)
    ? "top"
    : "bottom";

  // --- Use the current instance of the app services
  const mounted = useRef(false);
  useEffect(() => {
    appServicesCached = appServices;
    messengerCached = messenger;
    storeCached = store;

    // --- Whenever each of these props are known, we can state the UI is loaded
    if (!appServices || !store || !messenger || mounted.current) return;

    // --- Run the app initialiation sequence
    mounted.current = true;
    // --- Register the services to be used with the IDE
    registerCommands(appServices.ideCommandsService);

    // --- Sign that the UI is ready
    dispatch(ideLoadedAction());

    // --- Set the audio sample rate to use
    const audioCtx = new AudioContext();
    const sampleRate = audioCtx.sampleRate;
    audioCtx.close();
    dispatch(setAudioSampleRateAction(sampleRate));

    // --- Set up the IDE state
    dispatch(selectActivityAction(activityRegistry[0].id));
    const regTools = toolPanelRegistry.map(t => {
      return {
        id: t.id,
        name: t.name,
        visible: t.visible ?? true
      } as ToolInfo;
    });
    dispatch(setToolsAction(regTools));
    dispatch(activateToolAction(regTools.find(t => t.visible ?? true).id));
    dispatch(closeAllDocumentsAction());
  }, [appServices, store, messenger]);

  useEffect(() => {
    if (appPath) {
      initializeMonaco(appPath);
    }
  }, [appPath]);

  return (
    <div id='appMain' className={styles.app}>
      <IdeEventsHandler />
      {showToolbar && <Toolbar />}
      <div className={styles.mainContent}>
        <ActivityBar activities={activityRegistry} order={activityOrder} />
        <SplitPanel
          primaryLocation={primaryBarsPos}
          primaryPanel={<SiteBar />}
          primaryVisible={showSideBar}
          initialPrimarySize='250px'
          minSize={60}
          secondaryPanel={
            <SplitPanel
              primaryLocation={docPanelsPos}
              primaryPanel={<ToolArea siblingPosition={docPanelsPos} />}
              primaryVisible={showToolPanels}
              minSize={160}
              secondaryPanel={<DocumentArea />}
              secondaryVisible={!maximizeToolPanels}
              initialPrimarySize='33%'
            />
          }
        />
      </div>
      {showStatusBar && <IdeStatusBar />}

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
    </div>
  );
};

export default IdeApp;

// --- This channel processes main requests and sends the results back
ipcRenderer.on("MainToIde", async (_ev, msg: RequestMessage) => {
  // --- Do not process messages coming while app services are not cached.
  if (!appServicesCached) {
    ipcRenderer.send("MainToIdeResponse", {
      type: "NotReady"
    } as NotReadyResponse);
    return;
  }

  let response: ResponseMessage;
  try {
    response = await processMainToIdeMessages(
      msg,
      storeCached,
      messengerCached,
      appServicesCached
    );
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

function registerCommands (cmdSrv: IIdeCommandService): void {
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

  cmdSrv.registerCommand(new EraseAllBreakpointsCommand());
  cmdSrv.registerCommand(new ListBreakpointsCommand());
  cmdSrv.registerCommand(new SetBreakpointCommand());
  cmdSrv.registerCommand(new RemoveBreakpointCommand());
  cmdSrv.registerCommand(new EnableBreakpointCommand());

  cmdSrv.registerCommand(new NumCommand());
  cmdSrv.registerCommand(new DisassemblyCommand());
  cmdSrv.registerCommand(new OpenFolderCommand());
  cmdSrv.registerCommand(new NewProjectCommand());
  cmdSrv.registerCommand(new CloseFolderCommand());

  cmdSrv.registerCommand(new CompileCommand());
  cmdSrv.registerCommand(new InjectCodeCommand());
  cmdSrv.registerCommand(new RunCodeCommand());
  cmdSrv.registerCommand(new DebugCodeCommand());
  cmdSrv.registerCommand(new ExportCodeCommand());

  cmdSrv.registerCommand(new ProjectListExcludedItemsCommand());
  cmdSrv.registerCommand(new ProjectExcludeItemsCommand());
}
