import styles from "./AddressInput.module.scss";
import { useRef } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import classnames from "classnames";

type Props = {
  label: string;
  tooltip?: string;
  clearOnEnter?: boolean;
  decimalView: boolean;
  hexDigits?: number;
  inputWidth?: number;
  onAddressSent?: (addr: number) => Promise<void>;
  onGotFocus?: () => void;
};

export const AddressInput = ({
  label,
  tooltip,
  clearOnEnter = true,
  decimalView,
  hexDigits = 4,
  inputWidth,
  onAddressSent,
  onGotFocus,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const spanRef = useTooltipRef();
  const radix = decimalView ? 10 : 16;

  const handleBeforeInput = (e: FormEvent<HTMLInputElement>) => {
    const typed = (e.nativeEvent as InputEvent).data;
    if (!typed) return;
    if (typed < "0" || typed > "9") {
      if (decimalView || ((typed < "A" || typed > "F") && (typed < "a" || typed > "f"))) {
        e.preventDefault();
      }
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!inputRef.current || inputRef.current.value === "") {
        return;
      }
      if (onAddressSent) {
        void onAddressSent(parseInt(inputRef.current.value, radix));
      }
      if (clearOnEnter) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div ref={spanRef} className={styles.addressInput}>
      <span className={styles.headerLabel}>{label}</span>
      <input
        tabIndex={0}
        ref={inputRef}
        className={classnames(styles.addressPrompt)}
        maxLength={radix === 10 ? 7 : hexDigits}
        style={inputWidth ? { width: inputWidth } : undefined}
        onBeforeInput={handleBeforeInput}
        onKeyDown={handleKeyDown}
        onFocus={() => onGotFocus?.()}
      />
      {tooltip && (
        <TooltipFactory
          refElement={spanRef.current}
          placement="right"
          offsetX={-16}
          offsetY={28}
          showDelay={200}
          content={tooltip}
        />
      )}
    </div>
  );
};
