import styles from "@styles/app.module.scss";
import { ActivityBar } from "./ActivityBar/ActivityBar";
import { DocumentArea } from "./DocumentArea/DocumentArea";
import { SiteBar } from "./SideBar/SideBar";
import { SplitPanel } from "../controls/SplitPanel/SplitPanel";
import { ToolArea } from "./ToolArea/ToolArea";
import { Toolbar } from "../controls/Toolbar/Toolbar";
import { useEffect, useRef } from "react";
import {
  activateToolAction,
  closeAllDocumentsAction,
  selectActivityAction,
  setAudioSampleRateAction,
  setToolsAction,
  emuLoadedAction
} from "@state/actions";
import { ipcRenderer } from "electron";
import { RequestMessage } from "@messaging/messages-core";
import {
  useDispatch,
  useMessenger,
  useSelector,
  useStore
} from "../core/RendererProvider";
import { activityRegistry, toolPanelRegistry } from "../registry";
import { useAppServices } from "./services/AppServicesProvider";
import { AppServices, IInteractiveCommandService, ToolInfo } from "./abstractions";
import { MessengerBase } from "@messaging/MessengerBase";
import { Store } from "@state/redux-light";
import { AppState } from "@state/AppState";
import { processMainToIdeMessages } from "./MainToIdeProcessor";
import { IdeStatusBar } from "./StatusBar/IdeStatusBar";
import { app } from "electron/main";
import { ClearScreenCommand } from "./commands/ClearScreenCommand";
import { PauseMachineCommand, StartMachineCommand } from "./commands/MachineCommands";

// --- Store the singleton instances we use for message processing (out of React)
let appServicesCached: AppServices;
let messengerCached: MessengerBase;
let storeCached: Store<AppState>;

const IdeApp = () => {
  // --- Indicate the App has been loaded
  const mounted = useRef(false);
  const dispatch = useDispatch();

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
    ? "bottom"
    : "top";

  const appServices = useAppServices();
  const messenger = useMessenger();
  const store = useStore();

  // --- Use the current instance of the app services
  useEffect(() => {
    appServicesCached = appServices;
  }, [appServices]);

  // --- Use the current messenger instance
  useEffect(() => {
    messengerCached = messenger;
  }, [messenger]);

  // --- Use the current store instance
  useEffect(() => {
    storeCached = store;
  }, [store]);

  // --- Signify that the UI has been loaded
  useEffect(() => {
    if (mounted.current) return;

    // --- Register the services to be used with the IDE
    registerCommands(appServices.interactiveCommandsService);

    // --- Sign that the UI is ready
    mounted.current = true;
    dispatch(emuLoadedAction());

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
        i >= 3
      );
    }

    return () => {
      mounted.current = false;
    };
  });

  return (
    <div className={styles.app}>
      {showToolbar && <Toolbar />}
      <div className={styles.mainContent}>
        <ActivityBar activities={activityRegistry} order={activityOrder} />
        <SplitPanel
          id='main'
          primaryLocation={primaryBarsPos}
          primaryPanel={<SiteBar />}
          primaryVisible={showSideBar}
          initialPrimarySize='160px'
          minSize={60}
          secondaryPanel={
            <SplitPanel
              id='workbench'
              primaryLocation={docPanelsPos}
              primaryVisible={!maximizeToolPanels}
              minSize={25}
              primaryPanel={<DocumentArea />}
              secondaryPanel={<ToolArea siblingPosition={docPanelsPos} />}
              secondaryVisible={showToolPanels}
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

function registerCommands(cmdSrv: IInteractiveCommandService): void {
  if (commandsRegistered) return;

  commandsRegistered = true;
  cmdSrv.registerCommand(new ClearScreenCommand());
  cmdSrv.registerCommand(new StartMachineCommand());
  cmdSrv.registerCommand(new PauseMachineCommand());
}
