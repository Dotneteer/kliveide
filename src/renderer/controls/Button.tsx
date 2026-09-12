import classnames from "classnames";
import { useEffect, useRef } from "react";
import styles from "./Button.module.scss";

type Props = {
  text: string;
  visible?: boolean;
  disabled?: boolean;
  focusOnInit?: boolean;
  isDanger?: boolean,
  /**
   * `primary` (the default) is the filled accent that commits; `secondary` is the outline beside
   * it. A footer with two primaries says nothing about which button commits, which is what every
   * dialog footer looked like before this existed.
   */
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  spaceLeft?: number;
  spaceRight?: number;
  clicked?: () => void;
};

export const Button = ({
  text,
  visible = true,
  disabled = false,
  focusOnInit,
  isDanger,
  variant = "primary",
  type = "button",
  spaceLeft,
  spaceRight,
  clicked
}: Props) => {
  // --- Ensure the button gets the focus if requested
  const ref = useRef<HTMLButtonElement>(null);
  const focusSet = useRef(false);
  useEffect(() => {
    if (ref.current && focusOnInit && !focusSet.current) {
      setTimeout(() => {
        focusSet.current = true;
        ref.current?.focus();
      });
    }
  }, []);

  return visible ? (
    <button
      type={type}
      ref={ref}
      style={{ marginLeft: spaceLeft, marginRight: spaceRight }}
      className={classnames(styles.button, {
        [styles.isDanger]: isDanger,
        [styles.isSecondary]: variant === "secondary" && !isDanger
      })}
      disabled={disabled}
      onClick={() => clicked?.()}
    >
      {text}
    </button>
  ) : null;
};
