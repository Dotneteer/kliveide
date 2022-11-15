import { useState } from "react";
import styles from "styles/app.module.scss";
import { ActivityBar } from "./controls/ActivityBar/ActivityBar";
import { DocumentPanel } from "./controls/DocumentPanel/DocumentPanel";
import { SiteBar } from "./controls/SiteBar/SiteBar";
import { SplitPanel } from "./controls/SplitPanel/SplitPanel";
import { StatusBar } from "./controls/StatusBar/StatusBar";
import { ToolArea } from "./controls/ToolArea/ToolArea";
import { Toolbar } from "./controls/Toolbar/Toolbar";

const App: React.FC = () => {
  const [count, setCount] = useState(0)

  return (
    <div className={styles.app}>
      <Toolbar />
      <div className={styles.mainContent}>
        <ActivityBar />
        <SiteBar />
        <SplitPanel 
          primaryPanel={ 
            <DocumentPanel />
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
