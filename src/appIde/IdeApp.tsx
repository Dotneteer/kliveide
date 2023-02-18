import styles from "@styles/app.module.scss";
import { ActivityBar } from "./ActivityBar/ActivityBar";
import { DocumentArea } from "./DocumentArea/DocumentArea";
import { SiteBar } from "./SideBar/SideBar";
import { SplitPanel } from "../controls/SplitPanel";
import { ToolArea } from "./ToolArea/ToolArea";
import { Toolbar } from "../controls/Toolbar";
import { useEffect, useRef } from "react";
import {
  activateToolAction,
  closeAllDocumentsAction,
  selectActivityAction,
  setAudioSampleRateAction,
  setToolsAction,
  ideLoadedAction
} from "@state/actions";
import { ipcRenderer } from "electron";
import { NotReadyResponse, RequestMessage } from "@messaging/messages-core";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "../core/RendererProvider";
import { activityRegistry, toolPanelRegistry } from "../registry";
import { useAppServices } from "./services/AppServicesProvider";
import {
  AppServices,
  IInteractiveCommandService,
  ToolInfo
} from "./abstractions";
import { MessengerBase } from "@messaging/MessengerBase";
import { Store } from "@state/redux-light";
import { AppState } from "@state/AppState";
import { processMainToIdeMessages } from "./MainToIdeProcessor";
import { IdeStatusBar } from "./StatusBar/IdeStatusBar";
import { ClearScreenCommand } from "./commands/ClearScreenCommand";
import {
  PauseMachineCommand,
  RestartMachineCommand,
  StartDebugMachineCommand,
  StartMachineCommand,
  StepIntoMachineCommand,
  StepOutMachineCommand,
  StepOverMachineCommand,
  StopMachineCommand
} from "./commands/MachineCommands";
import {
  EnableBreakpointCommand,
  EraseAllBreakpointsCommand,
  ListBreakpointsCommand,
  RemoveBreakpointCommand,
  SetBreakpointCommand
} from "./commands/BreakpointCommands";
import { ClearHistoryCommand } from "./commands/ClearHistoryCommand";
import { NumCommand } from "./commands/NumCommand";
import { DisassemblyCommand } from "./commands/DisAssemblyCommand";
import { NewProjectCommand } from "./commands/NewProjectCommand";

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
  const showToolbar = useSelector(s => s.ideViewOptions.showToolbar);
  const showStatusBar = useSelector(s => s.ideViewOptions.showStatusBar);
  const showSideBar = useSelector(s => s.ideViewOptions.showSidebar);
  const showToolPanels = useSelector(s => s.ideViewOptions.showToolPanels);
  const maximizeToolPanels = useSelector(s => s.ideViewOptions.maximizeTools);

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
    for (let i = 0; i < 5; i++) {
      appServices.documentService.openDocument(
        {
          id: `doc-${i}`,
          name: `Document #${i}`,
          type: "CodeEditor",
          isReadOnly: i === 2
        },
        undefined,
        i >= 3
      );
    }
  }, [appServices, store, messenger]);

  return (
    <div className={styles.app}>
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
  cmdSrv.registerCommand(new NewProjectCommand());
}
