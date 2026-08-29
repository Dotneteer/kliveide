import classnames from "classnames";
import { useId, useRef } from "react";
import type { FormEvent, KeyboardEventHandler } from "react";
import { Icon } from "./Icon";
import styles from "./TextInput.module.scss";

type Props = {
  value: string;
  error?: string;
  width?: number | string;
  maxLength?: number;
  autoFocus?: boolean;
  buttonIcon?: string;
  buttonTitle?: string;
  numberOnly?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  onChange: (newValue: string) => void;
  browse?: () => Promise<string | undefined | null>;
};

export const TextInput = ({
  value,
  error,
  width,
  maxLength,
  autoFocus,
  buttonIcon,
  buttonTitle,
  numberOnly,
  onKeyDown,
  onChange,
  browse
}: Props) => {
  const errorId = useId();
  const ref = useRef<HTMLInputElement>(null);
  const handleBeforeInput = (e: FormEvent<HTMLInputElement>) => {
    const typed = (e.nativeEvent as InputEvent).data;
    if (typed && numberOnly && (typed < "0" || typed > "9")) {
      e.preventDefault();
    }
  };

  return (
    <div className={styles.inputContainer}>
      <div className={styles.inputRow}>
        <div className={styles.fullWidth}>
          <input
            ref={ref}
            className={classnames(styles.input, { [styles.invalid]: Boolean(error) })}
            style={{width}}
            value={value}
            maxLength={maxLength}
            autoFocus={autoFocus}
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onBeforeInput={handleBeforeInput}
            onKeyDown={onKeyDown}
            onChange={e => onChange(e.target.value)}
          />
        </div>
        {buttonIcon && (
          <div className={styles.iconWrapper}>
            <button
              type='button'
              className={styles.browseButton}
              aria-label={buttonTitle}
              onClick={async () => {
                const newValue = await browse?.();
                if (newValue != null) {
                  onChange(newValue);
                  ref.current?.focus();
                }
              }}
            >
              <Icon iconName={buttonIcon} height={20} width={20} fill='--color-command-icon' />
            </button>
          </div>
        )}
      </div>
      {error && <div id={errorId} className={styles.error} role='alert'>{error}</div>}
    </div>
  );
};
