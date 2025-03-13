import classnames from "classnames";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import styles from "./TextInput.module.scss";

type Props = {
  value?: string;
  isValid?: boolean;
  width?: number | string;
  maxLength?: number;
  focusOnInit?: boolean;
  buttonIcon?: string;
  buttonTitle?: string;
  numberOnly?: boolean;
  keyPressed?: (e: React.KeyboardEvent) => void;
  valueChanged?: (newValue: string) => boolean | undefined;
  buttonClicked?: (value: string) => Promise<string>;
};

export const TextInput = ({
  value,
  isValid,
  width,
  maxLength,
  focusOnInit,
  buttonIcon,
  buttonTitle,
  numberOnly,
  keyPressed,
  valueChanged,
  buttonClicked
}: Props) => {
  const [inputValue, setInputValue] = useState(value);

  // --- Ensure the input gets the focus if requested
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
    <div className={styles.inputContainer}>
      <div className={styles.fullWidth}>
        <input
          ref={ref}
          className={classnames(styles.input, { [styles.invalid]: !isValid })}
          style={{width}}
          value={inputValue}
          maxLength={maxLength}
          spellCheck={false}
          onBeforeInput={(e: any) => {
            const typed = e.data;
            if (numberOnly && (typed < "0" || typed > "9")) {
              e.preventDefault();
            }
          }}
          onKeyDown={e => keyPressed?.(e)}
          onChange={e => {
            const newValue = e.target.value;
            if (!valueChanged?.(newValue)) {
              setInputValue(e.target.value);
            }
          }}
        />
      </div>
      {buttonIcon && (
        <div className={styles.iconWrapper}>
          <IconButton
            iconName={buttonIcon}
            iconSize={24}
            title={buttonTitle}
            fill='--color-command-icon'
            clicked={async () => {
              const newValue = await buttonClicked?.(inputValue);
              if (newValue) {
                setInputValue(newValue);
                ref.current.focus();
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
