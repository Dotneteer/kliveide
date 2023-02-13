import styles from "./ToolbarSeparator.module.scss";
import classnames from "@/utils/classnames";

type Props = {
  small?: boolean;
};
/**
 * Represents a toolbar separator comonent
 */
export function ToolbarSeparator ({ small }: Props) {
  return (
    <div
      className={classnames(styles.toolbarSeparator, { [styles.small]: small })}
    >
      <div className={styles.separator} />
    </div>
  );
}
