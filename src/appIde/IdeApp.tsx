import { AppServices } from "@/abstractions/AppServices";
import { BackDrop } from "@/controls/BackDrop";
import { SplitPanel } from "@/controls/SplitPanel";
import { Toolbar } from "@/controls/Toolbar";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@/core/RendererProvider";
import { activityRegistry, toolPanelRegistry } from "@/registry";
import { ToolInfo } from "@common/abstractions/ToolInfo";
import { NEW_PROJECT_DIALOG } from "@common/messaging/dialog-ids";
import {
  RequestMessage,
  NotReadyResponse
} from "@common/messaging/messages-core";
import { MessengerBase } from "@common/messaging/MessengerBase";
import {
  ideLoadedAction,
  setAudioSampleRateAction,
  selectActivityAction,
  setToolsAction,
  activateToolAction,
  closeAllDocumentsAction,
  displayDialogAction
} from "@common/state/actions";
import { AppState } from "@common/state/AppState";
import { CODE_EDITOR } from "@common/state/common-ids";
import { Store } from "@common/state/redux-light";
import styles from "@styles/app.module.scss";
import { ipcRenderer } from "electron";
import { useRef, useEffect } from "react";
import { IInteractiveCommandService } from "./abstractions/IInteractiveCommandService";
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
import { processMainToIdeMessages } from "./MainToIdeProcessor";
import { useAppServices } from "./services/AppServicesProvider";
import { SiteBar } from "./SideBar/SideBar";
import { IdeStatusBar } from "./StatusBar/IdeStatusBar";
import { ToolArea } from "./ToolArea/ToolArea";

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
    registerCommands(appServices.interactiveCommandsService);

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

    // --- Temporary: open a few document panels
    dispatch(closeAllDocumentsAction());
  }, [appServices, store, messenger]);

  return (
    <div id='appMain' className={styles.app}>
      {showToolbar && <Toolbar />}
      <div className={styles.mainContent}>
        <ActivityBar activities={activityRegistry} order={activityOrder} />
        <SplitPanel
          primaryLocation={primaryBarsPos}
          primaryPanel={<SiteBar />}
          primaryVisible={showSideBar}
          initialPrimarySize='200px'
          minSize={60}
          secondaryPanel={
            <SplitPanel
              primaryLocation={docPanelsPos}
              primaryPanel={<ToolArea siblingPosition={docPanelsPos} />}
              primaryVisible={showToolPanels}
              minSize={60}
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

  const response = await processMainToIdeMessages(
    msg,
    storeCached,
    messengerCached,
    appServicesCached
  );
  response.correlationId = msg.correlationId;
  response.sourceId = "ide";
  ipcRenderer.send("MainToIdeResponse", response);
});

// --- Register the interactive commands
let commandsRegistered = false;

function registerCommands (cmdSrv: IInteractiveCommandService): void {
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
}
