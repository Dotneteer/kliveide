import { useRef, useState } from "react";
import { Sp48Keyboard } from "./Sp48Keyboard";
import { useResizeObserver } from "@/renderer/core/useResizeObserver";
import styles from "./KeyboardPanel.module.scss";

/**
 * Represents the keyboard panel of the emulator
 */
export const KeyboardPanel = () => {
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
      <Sp48Keyboard width={width} height={height} />
    </div>
  );
};
