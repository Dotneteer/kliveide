import { useEffect, useRef, useState } from "react";
import styles from "./AddressInput.module.scss";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import classnames from "classnames";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";

type Props = {
  label: string;
  eightBit?: boolean;
  initialValue?: number;
  clearOnEnter?: boolean;
  onAddressSent?: (addr: number) => Promise<void>;
};

export const AddressInput = ({
  label,
  eightBit,
  initialValue,
  clearOnEnter = true,
  onAddressSent
}: Props) => {
  const inputRef = useRef<HTMLInputElement>();
  const spanRef = useTooltipRef();
  const [radix, setRadix] = useState(16);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (inputRef.current && initialValue !== undefined) {
        inputRef.current.value =
          radix === 16
            ? eightBit
              ? toHexa2(initialValue)
              : toHexa4(initialValue)
            : initialValue.toString(10);
      }
    }
  });

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

    if (
      (e.code === "Enter" || e.code == "NumpadEnter") &&
      inputRef.current.value?.trim()
    ) {
      setTimeout(async () => {
        const address = parseInt(inputRef.current.value.trim(), radix);
        if (!isNaN(address)) {
          if (onAddressSent) {
            await onAddressSent(address);
          }
          if (clearOnEnter) {
            inputRef.current.value = "";
          }
        }
      });
    }
  };

  return (
    <div className={styles.addressInput}>
      <span className={styles.headerLabel}>{label}</span>
      <input
        ref={inputRef}
        className={classnames(styles.addressPrompt, {
          [styles.eightBit]: eightBit
        })}
        maxLength={radix === 10 ? (eightBit ? 3 : 5) : eightBit ? 2 : 4}
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
              inputRef.current.value = eightBit
                ? toHexa2(value)
                : toHexa4(value);
            setRadix(16);
          }
          inputRef.current.focus();
        }}
      >
        {radix === 16 ? "$" : "D"}
        <TooltipFactory
          refElement={spanRef.current}
          placement='right'
          offsetX={-16}
          offsetY={28}
          showDelay={200}
          content={`Type in a ${radix === 10 ? "decimal" : "hexadecimal"} address`}
        />
      </span>
    </div>
  );
};
