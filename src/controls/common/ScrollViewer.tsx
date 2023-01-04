import { useResizeObserver } from "@/core/useResizeObserver";
import { ReactNode, useEffect, useRef, useState } from "react";
import classnames from "@/utils/classnames";
import styles from "./ScrollViewer.module.scss";

type Props = {
  scrollBarWidth?: number;
  allowHorizontal?: boolean;
  allowVertical?: boolean;
  children?: ReactNode;
};

export const ScrollViewer = ({
  scrollBarWidth = 10,
  allowHorizontal = true,
  allowVertical = true,
  children
}: Props) => {
  const ref = useRef<HTMLDivElement>();
  const [pointed, setPointed] = useState(false);
  const vScroll = useRef(false);
  const hScroll = useRef(false);
  const vLeft = useRef(-1);
  const vTop = useRef(-1);
  const vHeight = useRef(-1);
  const vThumbHeight = useRef(-1);
  const hLeft = useRef(-1);
  const hTop = useRef(-1);
  const hWidth = useRef(-1);
  const hThumbWidth = useRef(-1);

  const updateDims = () => {
    const el = ref.current;
    if (!el) return;

    // --- Which scrollbast should be displayed?
    vScroll.current = allowVertical && el.scrollHeight > el.offsetHeight;
    hScroll.current = allowHorizontal && el.scrollWidth > el.offsetWidth;

    console.log(hScroll.current);

    // --- Calculate vertical scrollbar and thumb dimensions
    vTop.current = el.offsetTop;
    vLeft.current = el.offsetLeft + el.offsetWidth - scrollBarWidth;
    vHeight.current = vScroll.current
      ? el.offsetHeight - (hScroll.current ? scrollBarWidth : 0)
      : 0;
    vThumbHeight.current = vScroll.current
      ? (vHeight.current * vHeight.current) / el.scrollHeight
      : 0;

    // --- Calculate horizontal scrollbar and thumb dimensions
    hLeft.current = el.offsetLeft;
    hTop.current = el.offsetTop + el.offsetHeight - scrollBarWidth;
    hWidth.current = hScroll.current
      ? el.offsetWidth - (vScroll.current ? scrollBarWidth : 0)
      : 0;
    hThumbWidth.current = hScroll.current
      ? (hWidth.current * hWidth.current) / el.scrollWidth
      : 0;
  };

  useResizeObserver(ref, () => updateDims());
  useEffect(() => {
    updateDims();
  }, [pointed, ref.current]);

  return (
    <>
      <div
        ref={ref}
        className={styles.scrollViewer}
        onMouseEnter={() => setPointed(true)}
        onMouseLeave={() => setPointed(false)}
      >
        {children}
        {/* Vertical scrollbar */}
        {vScroll.current && (
          <div
            className={styles.vScrollbar}
            style={{
              left: vLeft.current,
              top: vTop.current,
              height: vHeight.current,
              width: scrollBarWidth
            }}
            onClick={() => console.log("vscroll clicked")}
          />
        )}
        {/* Vertical scrollbar thumb */}
        <div
          className={classnames(
            styles.vScrollbarThumb,
            vScroll.current && pointed ? styles.pointed : styles.unpointed
          )}
          style={{
            left: vLeft.current,
            top: vTop.current,
            height: vThumbHeight.current,
            width: scrollBarWidth
          }}
          onClick={() => console.log("vthumb clicked")}
        />
        {/* Horizontal scrollbar */}
        {vScroll.current && (
          <div
            className={styles.hScrollbar}
            style={{
              left: hLeft.current,
              top: hTop.current,
              height: scrollBarWidth,
              width: hWidth.current
            }}
            onClick={() => console.log("vscroll clicked")}
          />
        )}
        {/* Horizontal scrollbar thumb */}
        <div
          className={classnames(
            styles.hScrollbarThumb,
            hScroll.current && pointed ? styles.pointed : styles.unpointed
          )}
          style={{
            left: hLeft.current,
            top: hTop.current,
            height: scrollBarWidth,
            width: hThumbWidth.current
          }}
          onClick={() => console.log("vthumb clicked")}
        />
      </div>
    </>
  );
};
