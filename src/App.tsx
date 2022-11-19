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

const App = () => {
  const mounted = useRef(false);

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
      <Toolbar />
      <div className={styles.mainContent}>
        <ActivityBar />
        <SiteBar />
        <SplitPanel 
          primaryPosition="top"
          primaryPanel={ 
            <SplitPanel 
            primaryPosition="left"
            primaryPanel={ 
              <EmulatorArea />
            }
            secondaryPanel={ 
              <DocumentArea />
            }
          />
          }
          secondaryPanel={ 
            <ToolArea />
          }
        />
      </div>
      <StatusBar />
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

