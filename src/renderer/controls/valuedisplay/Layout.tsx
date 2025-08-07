import styles from "./Layout.module.scss";
import classnames from "classnames";

type LayoutProps = {
  children: React.ReactNode;
};

export const SidePanel = ({ children }: LayoutProps) => {
  return <div className={styles.sidePanel}>{children}</div>;
};

export const Row = ({ children }: LayoutProps) => {
  return <div className={styles.rows}>{children}</div>;
};

export const CenteredRow = ({ children }: LayoutProps) => {
  return <div className={classnames(styles.cols, styles.centered)}>{children}</div>;
}

export const Col = ({ children }: LayoutProps) => {
  return <div className={styles.cols}>{children}</div>;
};
