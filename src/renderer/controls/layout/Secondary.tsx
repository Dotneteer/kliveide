import styles from "./Layout.module.scss";

type Props = {
  text: string;
  width?: string | number;
};

export const Secondary = ({ text, width }: Props) => (
  <div className={styles.secondary} style={{ width }}>
    {text}
  </div>
);
