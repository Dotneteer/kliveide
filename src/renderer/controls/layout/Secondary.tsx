import styles from "./Layout.module.scss";

type Props = {
  /** Low-emphasis text rendered in the aligned cell. */
  text: string;
  /** Explicit secondary text cell width. */
  width?: string | number;
};

/**
 * Provides secondary text for low-emphasis values in compact rows.
 */
export const Secondary = ({ text, width }: Props) => (
  <div className={styles.secondary} style={{ width }}>
    {text}
  </div>
);
