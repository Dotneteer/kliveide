import classnames from "classnames";
import type { ReactNode } from "react";

import styles from "../SjasmplusIntegrationDialog.module.scss";

type RowProps = {
  label: string;
  children: ReactNode;
  wrap?: boolean;
};

export const Row = ({ label, children, wrap }: RowProps) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <div className={classnames(styles.value, { [styles.wrapValue]: wrap })}>{children}</div>
  </div>
);
