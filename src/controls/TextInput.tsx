import classnames from "@/utils/classnames";
import { useEffect, useRef, useState } from "react";
import styles from "./TextInput.module.scss";

type Props = {
  value?: string;
  isValid?: boolean;
  maxLength?: number;
  focusOnInit?: boolean;
  keyPressed?: (e: React.KeyboardEvent) => void;
  valueChanged?: (newValue: string) => (boolean | undefined);
};

export const TextInput = ({
  value,
  isValid,
  maxLength,
  focusOnInit,
  keyPressed,
  valueChanged
}: Props) => {
  const [inputValue, setInputValue] = useState(value);

  // --- Ensure the button gets the focus if requested
  const ref = useRef<HTMLInputElement>(null);
  const focusSet = useRef(false);
  useEffect(() => {
    if (ref.current && focusOnInit && !focusSet.current) {
      setTimeout(() => {
        focusSet.current = true;
        ref.current.focus();
      });
    }
  }, [ref.current]);

  return (
    <input
      ref={ref}
      className={classnames(styles.input, {[styles.invalid]: !isValid})}
      value={inputValue}
      maxLength={maxLength}
      spellCheck={false}
      onKeyDown={e => keyPressed?.(e)}
      onChange={e => {
        const newValue = e.target.value;
        if (!valueChanged?.(newValue)) {
            setInputValue(e.target.value);
        }
      }}
    />
  );
};
