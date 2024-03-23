import styles from "./ScriptingHistoryPanel.module.scss";
const ScriptingHistoryPanel = () => {
  return (
    <div className={styles.panel}>
      Scripting History
    </div>
  );
};

export const scriptingHistoryPanelRenderer = () => <ScriptingHistoryPanel />;
