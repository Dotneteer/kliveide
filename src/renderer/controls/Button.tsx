import classnames from "classnames";
import { useEffect, useRef } from "react";
import styles from "./Button.module.scss";

type Props = {
  text: string;
  visible?: boolean;
  disabled?: boolean;
  focusOnInit?: boolean;
  isDanger?: boolean,
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
      className={classnames(styles.button, {[styles.isDanger]: isDanger})}
      disabled={disabled}
      onClick={() => clicked?.()}
    >
      {text}
    </button>
  ) : null;
};
