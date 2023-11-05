import { useRef, useState } from "react";
import { Sp48Keyboard } from "./Sp48Keyboard";
import { Sp128Keyboard } from "./Sp128Keyboard";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import styles from "./KeyboardPanel.module.scss";

type KeyboardProps = {
  machineType?: string;
}

/**
 * Represents the keyboard panel of the emulator
 */
export const KeyboardPanel = ({machineType: type}: KeyboardProps) => {
  // --- Component state
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const hostElement = useRef<HTMLDivElement>();

  // --- Handle resizing
  useResizeObserver(hostElement, () => {
      setWidth(hostElement.current?.offsetWidth ?? 0);
      setHeight(hostElement.current?.offsetHeight ?? 0);
  });

  return (
    <div className={styles.keyboard} ref={hostElement}>
      {type === "sp48" && <Sp48Keyboard width={width} height={height} />}
      {type !== "sp48" && <Sp128Keyboard width={width} height={height} />}
    </div>
  );
};
