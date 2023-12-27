import { useRef, useState } from "react";
import { Sp48Keyboard } from "./Sp48Keyboard";
import { Sp128Keyboard } from "./Sp128Keyboard";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import styles from "./KeyboardPanel.module.scss";
import { Z88Keyboard } from "./Z88Keyboard";
import { useSelector } from "@renderer/core/RendererProvider";

export type KeyboardApi = {
  signKeyStatus: (code: number, down: boolean) => void;
};

type KeyboardProps = {
  machineType?: string;
  apiLoaded?: (api: KeyboardApi) => void;
};

/**
 * Represents the keyboard panel of the emulator
 */
export const KeyboardPanel = ({
  machineType: type,
  apiLoaded
}: KeyboardProps) => {
  // --- Component state
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const hostElement = useRef<HTMLDivElement>();
  const layout = useSelector(s => s.emuViewOptions.keyboardLayout);

  // --- Handle resizing
  useResizeObserver(hostElement, () => {
    setWidth(hostElement.current?.offsetWidth ?? 0);
    setHeight(hostElement.current?.offsetHeight ?? 0);
  });

  return (
    <div className={styles.keyboard} ref={hostElement}>
      {type === "sp48" && (
        <Sp48Keyboard width={width} height={height} apiLoaded={apiLoaded} />
      )}
      {type === "z88" && (
        <Z88Keyboard width={width} height={height} layout={layout}  apiLoaded={apiLoaded} />
      )}
      {type !== "sp48" && type !== "z88" && (
        <Sp128Keyboard width={width} height={height} apiLoaded={apiLoaded} />
      )}
    </div>
  );
};
