import classnames from "classnames";
import styles from "./GeneralControls.module.scss";

type Props = {
  xclass?: string;
  width?: string | number;
  children?: React.ReactNode;
};

export const Column = ({ xclass, width, children }: Props) => (
  <div className={classnames(styles.column, xclass)} style={{ width }}>
    {children}
  </div>
);
