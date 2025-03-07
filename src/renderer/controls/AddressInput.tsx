import styles from "./AddressInput.module.scss";
import { useRef } from "react";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import classnames from "classnames";

type Props = {
  label: string;
  tooltip?: string;
  clearOnEnter?: boolean;
  decimalView: boolean;
  onAddressSent?: (addr: number) => Promise<void>;
  onGotFocus?: () => void;
};

export const AddressInput = ({
  label,
  tooltip,
  clearOnEnter = true,
  decimalView,
  onAddressSent,
  onGotFocus,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>();
  const spanRef = useTooltipRef();
  const radix = decimalView ? 10 : 16;

  const handleBeforeInput = (e: any) => {
    const typed = e.data;
    console.log("typed");
    if (typed < "0" || typed > "9") {
      if (decimalView || ((typed < "A" || typed > "F") && (typed < "a" || typed > "f"))) {
        e.preventDefault();
      }
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter") {
      if (inputRef.current.value === "") {
        return;
      }
      if (onAddressSent) {
        onAddressSent(parseInt(inputRef.current.value, radix));
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
        maxLength={radix === 10 ? 5 : 4}
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
