import * as React from "react";

import { createPanel, createSizedStyledPanel } from "../../common/PanelStyles";
import { SvgIcon } from "../../common/SvgIcon";
import { useRef, useState } from "react";
import { CSSProperties } from "react";

/**
 * Component properties
 */
interface Props {
  title: string;
  expanded: boolean;
  sizeable: boolean;
  index: number;
  clicked: () => void;
  startResize: (index: number) => void;
  resized: (delta: number) => void;
}

/**
 * Represents the statusbar of the emulator
 */
export default function SideBarHeader(props: Props) {
  // --- Is this panel being dragged?
  const isResizing = useRef(false);

  // --- Component state
  const [focused, setFocused] = useState(false);
  const [pointed, setPointed] = useState(false);

  const hostElement: React.RefObject<HTMLDivElement> = React.createRef();
  const gripStyle: CSSProperties = {
    position: "absolute",
    height: "6px",
    width: "100%",
    background:
      pointed && props.sizeable
        ? "var(--toolbar-selected-border-color)"
        : "transparent",
    cursor: "ns-resize",
    transitionProperty: "background-color",
    transitionDuration: "0.25s",
    transitionDelay: "0.5s"
  };
  const borderStyle = focused
    ? "1px solid var(--toolbar-selected-border-color)"
    : "1px solid transparent";

  // --- We need a context that uses "this" function when handles the `move`
  // --- function to respond to document events
  const context: DragContext = {
    gripPosition: 0,
    move: (e: MouseEvent) => move(e, context),
    resized: (delta) => props.resized(delta),
  };

  const gripElement: React.RefObject<HTMLDivElement> = React.createRef();
  return (
    <Root
      ref={hostElement}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyPress={handleKeyPress}
      tabIndex={0}
      style={{
        borderLeft: borderStyle,
        borderRight: borderStyle,
        borderTop: borderStyle,
        borderBottom: focused
          ? borderStyle
          : "1px solid var(--panel-separator-border)",
      }}
    >
      {props.sizeable && (
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
              startResize(e);
            }
          }}
          onMouseUp={() => {
            endResize();
          }}
        />
      )}
      <Caption onClick={() => props.clicked?.()}>
        <SvgIcon
          iconName="chevron-right"
          width={16}
          height={16}
          rotate={props.expanded ? 90 : 0}
        ></SvgIcon>
        <Text>
          {props.title.toUpperCase()}({props.sizeable.toString()})
        </Text>
      </Caption>
    </Root>
  );

  /**
   * Use the Enter and Space keys as mouse clicks
   * @param e
   */
  function handleKeyPress(e: React.KeyboardEvent): void {
    if (e.code === "Enter" || e.code === "Space") {
      props.clicked?.();
    }
  }

  /**
   * Starts resizing this panel
   */
  function startResize(e: React.MouseEvent): void {
    isResizing.current = true;
    context.gripPosition = e.clientY;
    window.addEventListener("mouseup", endResize);
    window.addEventListener("touchend", endResize);
    window.addEventListener("touchcancel", endResize);
    window.addEventListener("mousemove", context.move);
    window.addEventListener("touchmove", context.move);
    document.body.style.cursor = "ns-resize";
    props.startResize(props.index);
  }

  /**
   * Ends resizing this panel
   */
  function endResize(): void {
    if (!isResizing.current) return;

    window.removeEventListener("mouseup", endResize);
    window.removeEventListener("touchend", endResize);
    window.removeEventListener("touchcancel", endResize);
    window.removeEventListener("mousemove", context.move);
    window.removeEventListener("touchmove", context.move);
    document.body.style.cursor = "";
  }

  /**
   * Change the size of the element 
   */
  function move(e: MouseEvent, context: DragContext): void {
    if (isResizing.current) {
      context.resized(e.clientY - context.gripPosition);
    }
  }
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  height: 24,
  fitToClient: false,
  others: {
    "border-bottom": "1px solid var(--panel-separator-border)",
    outline: "none",
  },
});

const Caption = createSizedStyledPanel({
  splitsVertical: false,
  others: {
    "align-items": "center",
    "padding-left": "4px",
  },
});

const Text = createPanel({
  color: "var(--sidebar-header-color)",
  "font-size": "0.8em",
  "font-weight": "600",
  "padding-left": "4px",
});

// --- Context for the drag operation
interface DragContext {
  gripPosition: number;
  move: (e: MouseEvent) => void;
  resized: (delta: number) => void;
}