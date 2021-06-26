import * as React from "react";
import { CSSProperties, useState } from "react";
import { contextMenuService, MenuItem } from "../command/ContextMenuService";
import { IToolPanel } from "./ToolAreaService";

interface Props {
  title: string;
  active: boolean;
  index: number;
  isLast: boolean;
  tool: IToolPanel;
  clicked?: () => void;
}

/**
 * Represents the statusbar of the emulator
 */
export default function DocumentTab({
  title,
  active,
  index,
  isLast,
  tool,
  clicked,
}: Props) {
  const [pointed, setPointed] = useState(false);
  const hostElement = React.createRef<HTMLDivElement>();

  const style: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    background: active
      ? "var(--document-tab-active-background-color)"
      : "var(--document-tab-background-color)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "10px",
    paddingRight: "10px",
    cursor: "pointer",
    fontSize: "0.9em",
    color: active
      ? "var(--document-tab-active-color)"
      : "var(--document-tab-color)",
  };

  // --- Create menu items
  const menuItems: MenuItem[] = [
    {
      id: "close",
      text: "Close",
      execute: () => {
        // ...
      },
    },
    {
      id: "closeAll",
      text: "CloseAll",
      execute: () => {
        // ...
      },
    },
    "separator",
    {
      id: "moveLeft",
      text: "Move Panel Left",
      enabled: index > 0,
      execute: () => {
        // ...
      },
    },
    {
      id: "moveRight",
      text: "Move Panel Right",
      enabled: !isLast,
      execute: () => {
        // ...
      },
    },
  ];

  return (
    <div
      ref={hostElement}
      style={style}
      onMouseDown={(e: React.MouseEvent) => {
        if (e.button === 0) {
          clicked?.();
        } else if (e.button === 2) {
          contextMenuService.openMenu(
            menuItems,
            e.clientY,
            e.clientX,
            hostElement.current
          );
        }
      }}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <span style={{ marginLeft: 6, marginRight: 6 }}>{title}</span>
    </div>
  );
}
