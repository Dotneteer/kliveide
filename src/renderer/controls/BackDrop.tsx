import styles from "./BackDrop.module.scss";

type Props = {
  visible: boolean;
};

export const BackDrop = ({ visible }: Props) => {
  return visible ? <div className={styles.backDrop} /> : null;
};
