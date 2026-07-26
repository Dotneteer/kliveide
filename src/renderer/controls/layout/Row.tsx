import classnames from "classnames";
import styles from "./Layout.module.scss";

type Props = {
  /** Extra CSS class appended to the row. */
  xclass?: string;
  /** Controls rendered horizontally in the row. */
  children?: React.ReactNode;
  /** Explicit row height. */
  height?: string | number;
};

/**
 * Provides a compact horizontal row for inspector-style control groups.
 */
export const Row = ({ children, xclass, height }: Props) => (
  <div className={classnames(styles.row, xclass)} style={{ height }}>
    {children}
  </div>
);

/**
 * Provides a header-styled row for labeling a group of compact controls.
 */
export const HeaderRow = ({ children, xclass, height }: Props) => (
  <Row xclass={classnames(xclass || styles.headerRow)} height={height}>
    {children}
  </Row>
);
