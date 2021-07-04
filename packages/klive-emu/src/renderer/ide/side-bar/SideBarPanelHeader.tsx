import * as React from "react";

import { createSizedStyledPanel } from "../../common/PanelStyles";
import styles from "styled-components";
import { SvgIcon } from "../../common/SvgIcon";
import { useState } from "react";
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
export default function SideBarPanelHeader(props: Props) {
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
          {props.title.toUpperCase()}
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
    setResizing(true);
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

const Text = styles.span`
  color: var(--sidebar-panel-header-color);
  font-size: 0.8em;
  font-weight: 600;
  padding-left: 4px;
  width: 100%;
  flex-grow: 1;
  flex-shrink: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// --- Context for the drag operation
interface DragContext {
  gripPosition: number;
  move: (e: MouseEvent) => void;
  resized: (delta: number) => void;
}
