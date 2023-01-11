import styles from "./AttachedShadow.module.scss";
import classnames from "@/utils/classnames";
import { useEffect, useRef, useState } from "react";

type Props = {
  parentElement: HTMLElement;
};

export const AttachedShadow = ({ parentElement }: Props) => {
  const [version, setVersion] = useState(0);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const [width, setWidth] = useState(0);
  const [show, setShow] = useState(false);

  // --- Check for parent element size changes
  const observer = useRef<ResizeObserver>();
  
  useEffect(() => {
    const resizer = () => {
      setTop(parentElement?.offsetTop ?? 0);
      setLeft(parentElement?.offsetLeft ?? 0);
      setWidth(parentElement?.offsetWidth ?? 0);
    }

    // --- We are already observing old element
    if (observer?.current && parentElement) {
      observer.current.unobserve(parentElement);
    }
    observer.current = new ResizeObserver(resizer);
    if (parentElement && observer.current) {
      observer.current.observe(parentElement);
    }
  }, [parentElement]);
  
  // --- Respond to parent scrollbar changes
  useEffect(() => {
    const scrolled = (e: Event) => {
      setShow(!!(parentElement?.scrollTop ?? 0));
    };

    if (parentElement) {
      parentElement.addEventListener("scroll", scrolled);
    }

    return () => {
      if (parentElement) {
        parentElement.removeEventListener("scroll", scrolled);
      }
    };
  }, [parentElement, version]);

  return <div className={classnames(styles.attachedShadow, show ? styles.show : "")} style={{
    top,
    left,
    width,
  }} />;
};
