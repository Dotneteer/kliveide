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

const App = () => {
  const mounted = useRef(false);

  useEffect(() => {
      if (mounted.current) return;

      mounted.current = true;
      const store = emuStore;

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
