import styles from "./Layout.module.scss";

type Props = {
  /** Width reserved to align following row content with labeled rows. */
  width?: number | string;
};

/**
 * Provides label-width spacing where a row needs alignment without visible text.
 *
 * This is a spacer, not a label: it used to borrow the `.label` class, which is why it inherited
 * that cell's colour and margins and reserved more room than the `width` it was given.
 */
export const LabelSeparator = ({ width = 4 }: Props) => (
  <div className={styles.spacer} style={{ width }} />
);
