import styles from "@styles/app.module.scss";
import { ActivityBar } from "./controls/ActivityBar/ActivityBar";
import { DocumentArea } from "./controls/DocumentArea/DocumentArea";
import { EmulatorArea } from "./controls/EmulatorArea/EmulatorArea";
import { SiteBar } from "./controls/SideBar/SideBar";
import { SplitPanel } from "./controls/SplitPanel/SplitPanel";
import { StatusBar } from "./controls/StatusBar/StatusBar";
import { ToolArea } from "./controls/ToolArea/ToolArea";
import { Toolbar } from "./controls/Toolbar/Toolbar";
import { useEffect, useRef } from "react";
import { 
  activateToolAction, 
  closeAllDocumentsAction, 
  selectActivityAction, 
  setAudioSampleRateAction, 
  setToolsAction, 
  uiLoadedAction 
} from "@state/actions";
import { ipcRenderer } from "electron";
import { RequestMessage } from "@messaging/message-types";
import { processMainToEmuMessages } from "./MainToEmuProcessor";
import { useDispatch, useSelector } from "./emu/StoreProvider";
import { activityRegistry, toolPanelRegistry } from "./registry";
import { useIdeServices } from "./ide/IdeServicesProvider";
import { IdeServices, ToolInfo } from "./ide/abstractions";

let singletonIdeServices: IdeServices;

const App = () => {
  // --- Indicate the App has been loaded
  const mounted = useRef(false);
  const dispatch = useDispatch();

  // --- Visual state
  const showToolbar = useSelector(s => s.emuViewOptions.showToolbar);
  const showStatusBar = useSelector(s => s.emuViewOptions.showStatusBar);
  const useEmuView = useSelector(s => s.emuViewOptions.useEmuView);
  const showSideBar = useSelector(s => s.emuViewOptions.showSidebar);
  const showToolPanels = useSelector(s => s.emuViewOptions.showToolPanels);
  const maximizeToolPanels = useSelector(s => s.emuViewOptions.maximizeTools);

  const activityOrder = useSelector(s => s.emuViewOptions.primaryBarOnRight) ? 3 : 0;
  const primaryBarsPos = useSelector(s => s.emuViewOptions.primaryBarOnRight) ? "right" : "left";
  const docPanelsPos = useSelector(s => s.emuViewOptions.toolPanelsOnTop) ? "bottom" : "top";

  const ideServices = useIdeServices();

  // --- Use the current instance of the IDE services
  useEffect(() => {
    singletonIdeServices = ideServices;
  }, [ideServices])

  // --- Signify that the UI has been loaded
  useEffect(() => {
      if (mounted.current) return;

      // --- Sign that the UI is ready
      mounted.current = true;
      dispatch(uiLoadedAction());

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
        } as ToolInfo
      });
      dispatch(setToolsAction(regTools));
      dispatch(activateToolAction(regTools.find(t => t.visible ?? true).id));

      // --- Temporary: open a few document panels
      dispatch(closeAllDocumentsAction());
      for (let i = 0; i < 5; i++) {
        ideServices.documentService.openDocument({
          id: `doc-${i}`,
          name: `Document #${i}`,
          type: "CodeEditor",
          isReadOnly: i === 2
        }, i >= 3);
      }

      return () => {
          mounted.current = false;
      }
  });

  return (
    <div className={styles.app}>
      {showToolbar && <Toolbar />}
      <div className={styles.mainContent}>
        {!useEmuView && <ActivityBar 
          activities={activityRegistry} 
          order={activityOrder} />}
        <SplitPanel
          id="main"
          primaryLocation={primaryBarsPos}
          primaryPanel={<SiteBar />}
          primaryVisible={!useEmuView && showSideBar}
          initialPrimarySize="160px"
          minSize={60}
          secondaryPanel={
            <SplitPanel 
              id="workbench"
              primaryLocation={docPanelsPos}
              primaryVisible={!maximizeToolPanels}
              minSize={25}
              primaryPanel={ 
                <SplitPanel
                id="docs"
                primaryLocation="left"
                primaryPanel={<EmulatorArea />}
                secondaryPanel={<DocumentArea />}
                secondaryVisible={!useEmuView}
                minSize={25}
              />
              }
              secondaryPanel={<ToolArea siblingPosition={docPanelsPos}/>}
              secondaryVisible={!useEmuView && showToolPanels}
            />
          }
        />
      </div>
      {showStatusBar && <StatusBar />}
    </div>
  )
}

export default App

// --- This channel processes main requests and sends the results back
ipcRenderer.on("MainToEmu", async (_ev, msg: RequestMessage) => {
  const response = await processMainToEmuMessages(msg, singletonIdeServices);
  response.correlationId = msg.correlationId;
  ipcRenderer.send("MainToEmuResponse", response);
});

