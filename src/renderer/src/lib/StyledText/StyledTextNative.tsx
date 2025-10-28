import { forwardRef, ReactNode } from "react";
import styles from "./StyledText.module.scss";
import classnames from "classnames";

type Props = {
  children?: ReactNode;
  text?: string;
  size?: "small" | "medium" | "large" | "xlarge";
  color?: string;
  className?: string;
};

export const defaultProps: Pick<Props, "size" | "color"> = {
  size: "medium",
  color: "inherit",
};

export const StyledText = forwardRef<HTMLSpanElement, Props>(
  ({ children, text, size = "medium", color = "inherit", className }, ref) => {
    const content = text || children;

    return (
      <span
        ref={ref}
        className={classnames(
          styles.styledText,
          styles[`size-${size}`],
          className
        )}
        style={{ color }}
      >
        {content}
      </span>
    );
  }
);

StyledText.displayName = "StyledText";
