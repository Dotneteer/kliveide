import * as React from "react";
import { useState, CSSProperties } from "react";

import { Icon } from "@components/Icon";
import { Fill } from "@components/Panels";

/**
 * Component properties
 */
interface Props {
  title: string;
  expanded: boolean;
  sizeable: boolean;
  index: number;
  clicked: () => void;
  rightClicked?: (e: React.MouseEvent) => void;
  startResize: (index: number) => void;
  resized: (delta: number) => void;
}

/**
 * Represents the statusbar of the emulator
 */
export default function SideBarPanelHeader({
  title,
  expanded,
  sizeable,
  index,
  clicked,
  rightClicked,
  startResize,
  resized,
}: Props) {
  // --- Component state
  const [focused, setFocused] = useState(false);
  const [pointed, setPointed] = useState(false);
  const [resizing, setResizing] = useState(false);

  const hostElement: React.RefObject<HTMLDivElement> = React.createRef();
  const gripStyle: CSSProperties = {
    position: "relative",
    height: "4px",
    width: "100%",
    background:
      pointed || resizing ? "var(--selected-border-color)" : "transparent",
    cursor: "ns-resize",
    transitionProperty: "background-color",
    transitionDuration: "0.1s",
    transitionDelay: "0.25s",
  };
  const borderStyle = focused
    ? "1px solid var(--selected-border-color)"
    : "1px solid transparent";

  // --- We need a context that uses "this" function when handles the `move`
  // --- function to respond to document events
  const context: DragContext = {
    gripPosition: 0,
    move: (e: MouseEvent) => move(e, context),
    resized: (delta) => resized(delta),
  };

  const gripElement: React.RefObject<HTMLDivElement> = React.createRef();
  return (
    <div
      ref={hostElement}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyPress={handleKeyPress}
      tabIndex={0}
      style={{
        ...rootStyle,
        borderLeft: borderStyle,
        borderRight: borderStyle,
        borderBottom: borderStyle,
        borderTop: focused
          ? borderStyle
          : "1px solid var(--panel-separator-border)",
      }}
    >
      {sizeable && (
        // --- We use this element for resizing the panel
        <div
          style={gripStyle}
          ref={gripElement}
          onMouseEnter={() => {
            setPointed(true);
          }}
          onMouseLeave={() => {
            setPointed(false);
          }}
          onMouseDown={(e) => {
            if (e.button === 0) {
              startResizing(e);
            }
          }}
          onMouseUp={() => {
            endResize();
          }}
        />
      )}
      <Fill
        style={{ paddingLeft: 4, alignItems: "center", flexDirection: "row" }}
        onClick={(e) => {
          if (e.button === 0) {
            clicked?.();
          }
        }}
        onMouseDown={(e) => {
          if (e.button === 2) {
            rightClicked?.(e);
          }
        }}
      >
        <Icon
          iconName="chevron-right"
          width={16}
          height={16}
          rotate={expanded ? 90 : 0}
        />
        <span style={textStyle}>{title.toUpperCase()}</span>
      </Fill>
    </div>
  );

  /**
   * Use the Enter and Space keys as mouse clicks
   * @param e
   */
  function handleKeyPress(e: React.KeyboardEvent): void {
    if (e.code === "Enter" || e.code === "Space") {
      clicked?.();
    }
  }

  /**
   * Starts resizing this panel
   */
  function startResizing(e: React.MouseEvent): void {
    setResizing(true);
    context.gripPosition = e.clientY;
    window.addEventListener("mouseup", endResize);
    window.addEventListener("touchend", endResize);
    window.addEventListener("touchcancel", endResize);
    window.addEventListener("mousemove", context.move);
    window.addEventListener("touchmove", context.move);
    document.body.style.cursor = "ns-resize";
    startResize(index);
  }

  /**
   * Ends resizing this panel
   */
  function endResize(): void {
    window.removeEventListener("mouseup", endResize);
    window.removeEventListener("touchend", endResize);
    window.removeEventListener("touchcancel", endResize);
    window.removeEventListener("mousemove", context.move);
    window.removeEventListener("touchmove", context.move);
    document.body.style.cursor = "";
    setResizing(false);
  }

  /**
   * Change the size of the element
   */
  function move(e: MouseEvent, context: DragContext): void {
    context.resized(e.clientY - context.gripPosition);
  }
}

const rootStyle: CSSProperties = {
  height: 24,
  flexShrink: 0,
  flexGrow: 0,
  borderBottom: "1px solid var(--panel-separator-border)",
  outline: "none",
};

const textStyle: CSSProperties = {
  color: "var(--sidebar-panel-header-color)",
  fontSize: "0.8em",
  fontWeight: 600,
  paddingLeft: 4,
  width: "100%",
  flexGrow: 1,
  flexShrink: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// --- Context for the drag operation
interface DragContext {
  gripPosition: number;
  move: (e: MouseEvent) => void;
  resized: (delta: number) => void;
}