import styles from "./Layout.module.scss";

type Props = {
  /** Width reserved to align following row content with labeled rows. */
  width?: number | string;
};

/**
 * Provides label-width spacing where a row needs alignment without visible text.
 */
export const LabelSeparator = ({ width = 4 }: Props) => (
  <div className={styles.label} style={{ width }} />
);
