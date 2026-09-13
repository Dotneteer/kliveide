import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { CSSProperties, DOMAttributes } from "react";

/**
 * Event arguments when pressing a key on the ZX Spectrum 48 virtual keyboard
 */
export interface KeyboardButtonClickArgs {
  code: number;
  keyCategory: string;
  button: number;
  secondaryButton?: number;
  extMode?: boolean;
  down: boolean;
}

/**
 * Generic panel properties
 */
export type PanelProps<P = {}> = P &
  DOMAttributes<HTMLDivElement> & {
    id?: string;
    useColumns?: boolean;
    flexible?: boolean;
    style?: CSSProperties;
    hostRef?: React.RefObject<HTMLDivElement>;
    onResized?: () => void;
  };

/**
 * Properties of a column panel
 */
export type ColumnProps = PanelProps<{
  width?: string | number;
  flexible?: boolean;
}>;

/**
 * Column panel
 */
export const Column: React.FC<ColumnProps> = ({
  children,
  width,
  flexible,
  style,
  hostRef,
  ...others
}) => {
  if (flexible == undefined && width == undefined) flexible = true;
  return (
    <div
      ref={hostRef}
      style={{
        margin: 0,
        display: "flex",
        height: "100%",
        width: width ?? "100%",
        flexShrink: flexible ? 1 : 0,
        flexGrow: flexible ? 1 : 0,
        overflow: "hidden",
        ...style
      }}
      {...others}
    >
      {children}
    </div>
  );
};

/**
 * Row panel properties
 */
export type RowProps = PanelProps<{
  height?: string | number;
}>;

/**
 * Row panel
 */
export const Row: React.FC<RowProps> = ({
  children,
  height,
  flexible,
  style,
  hostRef,
  onResized,
  ...others
}) => {
  if (flexible == undefined && height == undefined) flexible = true;
  // --- Respond to resizing the main container
  useResizeObserver(hostRef, () => onResized?.());
  return (
    <div
      ref={hostRef}
      style={{
        margin: 0,
        width: "100%",
        display: "flex",
        height: height ?? "100%",
        flexShrink: flexible ? 1 : 0,
        flexGrow: flexible ? 1 : 0,
        overflow: "hidden",
        ...style
      }}
      {...others}
    >
      {children}
    </div>
  );
};

/**
 * The zoom factor that fits a keyboard of `defaultWidth` x `defaultHeight` into the panel.
 *
 * All four keyboards carried a byte-identical copy of this, each with its own `DEFAULT_WIDTH` /
 * `DEFAULT_HEIGHT` constants closed over — so the two inset numbers (24 horizontal, 12 vertical)
 * were repeated four times with nothing keeping them in step.
 */
export function calculateKeyboardZoom(
  width: number,
  height: number,
  defaultWidth: number,
  defaultHeight: number
): number {
  if (!width || !height) return 0.05;
  const widthRatio = (width - KEYBOARD_INSET_X) / defaultWidth;
  const heightRatio = (height - KEYBOARD_INSET_Y) / defaultHeight;
  return Math.min(widthRatio, heightRatio);
}

/** Room left around the keyboard so it never touches the panel edge. */
const KEYBOARD_INSET_X = 24;
const KEYBOARD_INSET_Y = 12;

/** The shared layout of a keyboard root, previously declared once per keyboard. */
export const keyboardRootStyle: CSSProperties = {
  boxSizing: "border-box",
  flexDirection: "column",
  alignContent: "start",
  justifyItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  userSelect: "none"
};

/** The shared layout of a keyboard row. */
export const keyboardRowStyle: CSSProperties = {
  padding: "0px 0px",
  fontWeight: "bold"
};
