import classnames from "classnames";
import styles from "./Layout.module.scss";

type Props = {
  /** Extra CSS class appended to the column. */
  xclass?: string;
  /** Explicit column width. */
  width?: string | number;
  /** Rows or controls stacked inside the column. */
  children?: React.ReactNode;
};

/**
 * Provides a vertical column for stacking related rows or controls.
 */
export const Column = ({ xclass, width, children }: Props) => (
  <div className={classnames(styles.column, xclass)} style={{ width }}>
    {children}
  </div>
);
