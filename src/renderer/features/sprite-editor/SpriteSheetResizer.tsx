import styles from "./SpriteEditor.module.scss";
import classnames from "classnames";
import { useCallback, useRef, useState } from "react";
import { SHEET_ROW_HEIGHT } from "./sheet-metrics";

type Props = {
  height: number;
  onResize: (height: number) => void;
  /** Called once when the drag ends, so the view state is written on release rather than per pixel. */
  onResizeEnd: (height: number) => void;
  onReset: () => void;
};

/**
 * The grab strip along the top of the sheet pane.
 *
 * It follows `SplitPanel`'s idiom rather than inventing a second one: a transparent grab zone with
 * the visible hairline as an inset pseudo-element, so the hit area is comfortably larger than the
 * line the user sees, and the line takes the accent while pointed or dragging.
 *
 * Pointer capture rather than window listeners. The canvas's own drag machinery uses `window`
 * because it predates this and has to survive the pointer leaving the grid - but capture is the
 * right tool where it fits: the browser routes every move and the release to this element, so there
 * is nothing to unbind and nothing to leak if the component goes away mid-drag.
 */
export const SpriteSheetResizer = ({ height, onResize, onResizeEnd, onReset }: Props) => {
  const [active, setActive] = useState(false);
  const [pointed, setPointed] = useState(false);
  const drag = useRef<{ startY: number; startHeight: number; latest: number } | undefined>();

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { startY: e.clientY, startHeight: height, latest: height };
      setActive(true);
    },
    [height]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = drag.current;
      if (!state) return;
      // Dragging *up* makes the sheet taller, because the handle is on its top edge.
      const next = state.startHeight + (state.startY - e.clientY);
      state.latest = next;
      onResize(next);
    },
    [onResize]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = drag.current;
      if (!state) return;
      drag.current = undefined;
      setActive(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      onResizeEnd(state.latest);
    },
    [onResizeEnd]
  );

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the sheet"
      aria-valuenow={Math.round(height / SHEET_ROW_HEIGHT)}
      tabIndex={-1}
      className={classnames(styles.sheetResizer, { [styles.sheetResizerActive]: active || pointed })}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => setPointed(true)}
      onPointerLeave={() => setPointed(false)}
      // Double-click restores the two-row default - the cheapest way back from a drag that went
      // somewhere silly, and the reason the default is a named constant rather than a literal.
      onDoubleClick={onReset}
      title={"Drag to resize the sheet\nDouble-click to reset"}
    />
  );
};
