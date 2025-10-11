import styles from "./WatchPanel.module.scss";

const WatchPanel = () => {
  return (
    <div className={styles.watchPanel}>
      <div className={styles.center}>No watchpoints defined </div>
    </div>
  );
};

export const watchPanelRenderer = () => <WatchPanel />;
