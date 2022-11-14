import { useState } from "react";
import styles from "styles/app.module.scss";
import { ActivityBar } from "./controls/ActivityBar/ActivityBar";
import { SiteBar } from "./controls/SiteBar/SiteBar";
import { StatusBar } from "./controls/StatusBar/StatusBar";
import { Toolbar } from "./controls/Toolbar/Toolbar";

const App: React.FC = () => {
  const [count, setCount] = useState(0)

  return (
    <div className={styles.app}>
      <Toolbar />
      <div className={styles.mainContent}>
        <ActivityBar />
        <SiteBar />
        <div className={styles.workbench}>

        </div>
      </div>
      <StatusBar />
    </div>
  )
}

export default App
