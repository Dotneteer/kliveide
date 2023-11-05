import styles from "./DialogLabel.module.scss";

type DialoglabelProps = {
  text: string;
};

export const DialogLabel = ({ text }: DialoglabelProps) => {
  return <div className={styles.label}>{text}</div>;
};
