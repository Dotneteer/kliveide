import styles from "./Layout.module.scss";

type Props = {
  width: number | string;
};

export const LabelSeparator = ({ width }: Props) => (
  <div className={styles.label} style={{ width }} />
);
