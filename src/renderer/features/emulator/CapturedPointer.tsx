import { forwardRef } from "react";

import styles from "./CapturedPointer.module.scss";

/**
 * Klive's own pointer, drawn over the machine's screen while the mouse is captured.
 *
 * It exists because a captured mouse that nothing is reading is otherwise completely invisible -
 * the host cursor is hidden, and if no program polls the mouse ports there is nothing on screen to
 * show that the mouse works at all. That is the case this indicator is for.
 *
 * It is **not** the machine's pointer, and it is drawn so nobody mistakes it for one: a ring and a
 * crosshair in the accent colour rather than an arrow. When software *is* reading the mouse it
 * draws its own pointer from its own counters, and the two drift apart within seconds - the machine
 * scales movement by its DPI setting, starts from its own origin, and its counters wrap where this
 * one stops at the edge of the screen. Step 7 of the plan hides this indicator automatically
 * whenever the machine has read the mouse ports recently, which is the real fix for that.
 *
 * `useEmulatorMouse` writes the `transform` and the `data-buttons` attribute directly on the node:
 * it updates at display rate, so it must not go through React state.
 */
export const CapturedPointer = forwardRef<HTMLDivElement>((_props, ref) => (
  <div className={styles.layer} aria-hidden="true">
    <div ref={ref} className={styles.pointer} data-buttons="0" />
  </div>
));

CapturedPointer.displayName = "CapturedPointer";
