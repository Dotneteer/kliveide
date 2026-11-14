import { CSSProperties, forwardRef, ReactNode } from "react";
import classnames from "classnames";
import styles from "./FullScreenEdgeBar.module.scss";

type Props = {
  edge: "top" | "bottom";
  /** The full screen mode is on; off, the wrapper adds no box and its child sits in the layout */
  active: boolean;
  shown: boolean;
  /** How far from its edge the bar slides in, in CSS pixels (the top bar: under the macOS menu bar) */
  inset?: number;
  children?: ReactNode;
};

/**
 * A bar the emulator's full screen mode slides in over the picture at the top or the bottom edge
 * (`dev/plans/EMU_FULL_SCREEN_MODE_PLAN.md` §2.3). Hidden, it is `inert`: no pointer, no focus.
 *
 * It wraps its bar in both modes, so switching the mode never remounts the toolbar or the status
 * bar: a remounted status bar has no machine controller until the next machine change
 * (`useMachineController`), and would show no clock and no frame readouts.
 */
export const FullScreenEdgeBar = forwardRef<HTMLDivElement, Props>(
  ({ edge, active, shown, inset = 0, children }, ref) => (
    <div
      ref={ref}
      data-testid={`emu-full-screen-${edge}`}
      data-shown={active && shown ? "true" : "false"}
      className={
        active
          ? classnames(styles.edgeBar, styles[edge], { [styles.shown]: shown })
          : styles.inLayout
      }
      style={active && inset > 0 ? ({ "--emu-full-screen-inset": `${inset}px` } as CSSProperties) : undefined}
      {...(active && !shown ? { inert: "" } : {})}
    >
      {children}
    </div>
  )
);
FullScreenEdgeBar.displayName = "FullScreenEdgeBar";
