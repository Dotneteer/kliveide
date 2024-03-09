import { ReactNode } from "react";
import styles from "./DialogRow.module.scss";
import { DialogLabel } from "./DialogLabel";
import classnames from "@renderer/utils/classnames";

type DialogRowProps = {
  label?: string;
  children?: ReactNode;
  rows?: boolean;
};

export const DialogRow = ({ label = "", children, rows }: DialogRowProps) => {
  return (
    <div className={styles.dialogRow}>
      {label && <DialogLabel text={label} />}
      <div className={classnames(styles.childWrapper, { [styles.rows]: rows })}>
        {children}
      </div>
    </div>
  );
};
