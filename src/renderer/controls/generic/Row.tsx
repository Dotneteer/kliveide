import classnames from "@renderer/utils/classnames";
import styles from "./GeneralControls.module.scss";

type Props = {
  xclass?: string;
  children?: React.ReactNode;
  height?: string | number;
};

// --- Represents a row in a panel
export const Row = ({ children, xclass, height }: Props) => (
  <div className={classnames(styles.row, xclass)} style={{ height }}>
    {children}
  </div>
);

export const HeaderRow = ({ children }: Props) => (
  <Row xclass={styles.headerRow}>{children}</Row>
);
