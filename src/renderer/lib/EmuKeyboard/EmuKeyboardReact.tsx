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
      const style = window.getComputedStyle(host);
      const horizontalPadding =
        Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const verticalPadding =
        Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
      setSize({
        width: Math.max(0, host.offsetWidth - horizontalPadding),
        height: Math.max(0, host.offsetHeight - verticalPadding)
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
