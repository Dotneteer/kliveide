import { useRef, useState } from "react";
import styles from "./AddressInput.module.scss";
import { TooltipFactory } from "./Tooltip";

type Props = {
  label: string;
  onAddressSent?: (addr: number) => Promise<void>;
};

export const AddressInput = ({ label, onAddressSent }: Props) => {
  const inputRef = useRef<HTMLInputElement>();
  const spanRef= useRef<HTMLSpanElement>(null);
  const [radix, setRadix] = useState(16);
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (
      !(
        (e.key >= "0" && e.key <= "9") ||
        (radix === 16 && e.code >= "KeyA" && e.code <= "KeyF") ||
        e.code === "Backspace" ||
        e.code === "Delete" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "Enter" ||
        e.code === "NumpadEnter"
      )
    ) {
      e.preventDefault();
    }

    if ((e.code === "Enter" || e.code == "NumpadEnter") && inputRef.current.value?.trim()) {
      setTimeout(async () => {
        const address = parseInt(inputRef.current.value.trim(), radix);
        if (!isNaN(address)) {
          if (onAddressSent) {
            await onAddressSent(address);
          }
          inputRef.current.value = "";
        }
      });
    }
  };
  return (
    <div className={styles.addressInput}>
      <span className={styles.headerLabel}>{label}</span>
      <input
        ref={inputRef}
        className={styles.addressPrompt}
        maxLength={radix === 10 ? 5 : 4}
        onKeyDown={handleKeyPress}
      />
      <span
        ref={spanRef}
        className={styles.radixLabel}
        onClick={() => {
          if (radix === 16) {
            const value = parseInt(inputRef.current.value.trim(), 16);
            if (!isNaN(value)) {
              inputRef.current.value = value.toString(10);
            }
            setRadix(10);
          } else {
            const value = parseInt(inputRef.current.value.trim(), 10);
            if (!isNaN(value))
            inputRef.current.value = value.toString(16);
            setRadix(16);
          }
          inputRef.current.focus();
        }}
      >
        {radix === 16 ? "16" : "10"}
        <TooltipFactory
          refElement={spanRef.current}
          placement='right'
          offsetX={-16}
          offsetY={28}
          showDelay={200}
        >
          {`Type in a ${radix === 10 ? "decimal" : "hexadecimal"} address`}
        </TooltipFactory>
      </span>
    </div>
  );
};
