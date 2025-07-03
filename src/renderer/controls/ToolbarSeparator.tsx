import styles from "./ToolbarSeparator.module.scss";
import classnames from "classnames";
import { memo } from "react";

type ToolbarSeparatorProps = {
  /** When true, renders a smaller version of the separator */
  small?: boolean;
  /** Optional test ID for testing */
  "data-testid"?: string;
};

/**
 * A visual separator for toolbars that provides a vertical dividing line
 * between toolbar sections or items.
 */
export const ToolbarSeparator = memo(({ 
  small, 
  "data-testid": dataTestId = "toolbar-separator" 
}: ToolbarSeparatorProps) => {
  return (
    <div
      className={classnames(styles.toolbarSeparator, { [styles.small]: small })}
      data-testid={dataTestId}
    >
      <div className={styles.separator} />
    </div>
  );
});
