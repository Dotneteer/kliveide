import styles from "./Layout.module.scss";

/**
 * Provides a horizontal divider between compact layout groups.
 */
export const Separator = () => <hr className={styles.separator} aria-hidden="true" />;
