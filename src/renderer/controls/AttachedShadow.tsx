import styles from "./AttachedShadow.module.scss";
import classnames from "@/renderer/utils/classnames";
import { useEffect, useRef, useState } from "react";

type Props = {
  parentElement: HTMLElement;
  visible: boolean;
};

export const AttachedShadow = ({ parentElement, visible }: Props) => {
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const [width, setWidth] = useState(0);

  // --- Check for parent element size changes
  const observer = useRef<ResizeObserver>();

  useEffect(() => {
    const resizer = () => {
      setTop(parentElement?.offsetTop ?? 0);
      setLeft(parentElement?.offsetLeft ?? 0);
      setWidth(parentElement?.offsetWidth ?? 0);
    };

    // --- We are already observing old element
    if (observer?.current && parentElement) {
      observer.current.unobserve(parentElement);
    }
    observer.current = new ResizeObserver(resizer);
    if (parentElement && observer.current) {
      observer.current.observe(parentElement);
    }
  }, [parentElement]);

  return (
    <div
      className={classnames(styles.attachedShadow, { [styles.show]: visible })}
      style={{
        top,
        left,
        width
      }}
    />
  );
};
