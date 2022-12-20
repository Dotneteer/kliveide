import styles from "./ToolbarSeparator.module.scss";

/**
 * Represents a toolbar separator comonent
 */
export function ToolbarSeparator() {
    return (
      <div className={styles.component}>
        <div className={styles.separator} />
      </div>
    );
  }