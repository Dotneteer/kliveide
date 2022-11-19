import styles from "styles/app.module.scss";
import { ActivityBar } from "./controls/ActivityBar/ActivityBar";
import { DocumentArea } from "./controls/DocumentArea/DocumentArea";
import { EmulatorArea } from "./controls/EmulatorArea/EmulatorArea";
import { SiteBar } from "./controls/SiteBar/SiteBar";
import { SplitPanel } from "./controls/SplitPanel/SplitPanel";
import { StatusBar } from "./controls/StatusBar/StatusBar";
import { ToolArea } from "./controls/ToolArea/ToolArea";
import { Toolbar } from "./controls/Toolbar/Toolbar";
import { emuStore } from "./emu/emu-store";
import { useEffect, useRef } from "react";
import { uiLoadedAction } from "@state/actions";
import { ipcRenderer } from "electron";
import { RequestMessage } from "@messaging/message-types";
import { processMainToEmuMessages } from "./MainToEmuProcessor";
import { useSelector } from "./emu/StoreProvider";

const App = () => {
  // --- Indicate the App has been loaded
  const mounted = useRef(false);

  // --- Visual state
  const showToolbar = useSelector(s => s.emuViewOptions.showToolbar);
  const showStatusBar = useSelector(s => s.emuViewOptions.showStatusBar);
  const useEmuView = useSelector(s => s.emuViewOptions.useEmuView);
  const showSideBar = useSelector(s => s.emuViewOptions.showSidebar);
  const showToolPanels = useSelector(s => s.emuViewOptions.showToolPanels);

  const activityOrder = useSelector(s => s.emuViewOptions.primaryBarOnRight) ? 3 : 0;
  const sideBarOrder = useSelector(s => s.emuViewOptions.primaryBarOnRight) ? 2 : 0;

  // --- Signify that the UI has been loaded
  useEffect(() => {
      if (mounted.current) return;

      mounted.current = true;
      const store = emuStore;
      store.dispatch(uiLoadedAction());

      return () => {
          mounted.current = false;
      }
  });

  return (
    <div className={styles.app}>
      {showToolbar && <Toolbar />}
      <div className={styles.mainContent}>
        {!useEmuView && <ActivityBar order={activityOrder} />}
        {!useEmuView && showSideBar && <SiteBar order={sideBarOrder} />}
        <SplitPanel
          primaryPosition="bottom"
          primaryPanel={ 
            <SplitPanel 
            primaryPosition="top"
            primaryPanel={<EmulatorArea />}
            secondaryPanel={<DocumentArea />}
            secondaryVisible={!useEmuView}
          />
          }
          secondaryPanel={<ToolArea />}
          secondaryVisible={!useEmuView && showToolPanels}
        />
      </div>
      {showStatusBar && <StatusBar />}
    </div>
  )
}

export default App

// --- This channel processes main requests and sends the results back
ipcRenderer.on("MainToEmu", async (_ev, msg: RequestMessage) => {
  const response = await processMainToEmuMessages(msg);
  response.correlationId = msg.correlationId;
  ipcRenderer.send("MainToEmuResponse", response);
});

