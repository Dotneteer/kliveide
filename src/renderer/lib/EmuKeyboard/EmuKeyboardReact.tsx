import { useEffect, useRef, useState } from "react";
import styles from "./EmuKeyboard.module.scss";
import { Sp48KeyboardReact } from "./Sp48KeyboardReact";

type Props = {
  machineType?: string;
};

export function EmuKeyboardReact({ machineType = "sp48" }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const updateSize = () => {
      setSize({
        width: host.offsetWidth,
        height: host.offsetHeight
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.keyboard} ref={hostRef}>
      {machineType === "sp48" ? (
        <Sp48KeyboardReact width={size.width} height={size.height} />
      ) : (
        <div className={styles.fallback}>{machineType} keyboard is not migrated yet.</div>
      )}
    </div>
  );
}
