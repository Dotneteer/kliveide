import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import { useEffect, useState } from "react";
import { animationTick } from "../../../renderer/common/utils";
import SideBarPanelHeader from "./SideBarPanelHeader";
import { ISideBarPanel, sideBarService } from "./SideBarService";
import { MenuItem } from "../../../shared/command/commands";
import { contextMenuService } from "../context-menu/ContextMenuService";

/**
 * Component properties
 */
interface Props {
  descriptor: ISideBarPanel;
  index: number;
  isLast: boolean;
  sizeable: boolean;
  heightPercentage: number;
  visibilityChanged: (index: number) => void;
  startResize: (index: number) => void;
  resized: (delta: number) => void;
}

/**
 * Represents a panel of the side bar
 * A side bar panel is composed from a header and a content panel. The header
 * allows expanding or collapsing the panel, and provides a resizing grip.
 */
export default function SideBarPanel({
  descriptor,
  index,
  isLast,
  sizeable,
  visibilityChanged,
  startResize,
  resized,
}: Props) {
  const hostElement: React.RefObject<HTMLDivElement> = React.createRef();
  const [expanded, setExpanded] = useState(descriptor.expanded);
  const [resizeCount, setResizeCount] = useState(0);

  // --- Create menu items
  const menuItems: MenuItem[] = [
    {
      id: "moveUp",
      text: "Move Panel Up",
      enabled: index > 0,
      execute: () => {
        sideBarService.moveUp(index);
      },
    },
    {
      id: "moveDown",
      text: "Move Panel Down",
      enabled: !isLast,
      execute: () => {
        sideBarService.moveDown(index);
      },
    },
  ];

  useEffect(() => {
    // --- Get the initial width
    (async () => {
      await animationTick();
      if (hostElement.current) {
        descriptor.height = hostElement.current.offsetHeight;
      }
    })();
  });

  return (
    <div
      ref={hostElement}
      className={expanded ? "expanded" : "collapsed"}
      style={{
        height: expanded ? `${descriptor.heightPercentage}%` : null,
        transitionProperty: "height",
        transitionDuration: "0.25s",
        overflow: "hidden",
      }}
    >
      <SideBarPanelHeader
        title={descriptor.title}
        expanded={expanded}
        sizeable={sizeable}
        index={index}
        clicked={async () => {
          const newExpanded = !expanded;
          setExpanded(newExpanded);
          descriptor.expanded = newExpanded;
          visibilityChanged(index);
        }}
        rightClicked={async (e) => {
          await contextMenuService.openMenu(
            menuItems,
            e.clientY,
            e.clientX,
            hostElement.current
          );
        }}
        startResize={(index: number) => startResize(index)}
        resized={(delta: number) => resized(delta)}
      />
      <div
        className="host-panel"
        style={{
          display: expanded ? undefined : "none",
          color: "var(--information-color)",
          overflow: "hidden",
          fontSize: "1.1em",
        }}
      >
        <div
          style={{
            height: 1,
            background: "transparent",
            boxShadow: "rgb(0,0,0) 0px 6px 6px -6px inset",
            flexShrink: 0,
          }}
        />
        {descriptor.createContentElement()}
      </div>
      <ReactResizeDetector
        handleWidth
        handleHeight
        onResize={(_width, height) => {
          descriptor.height = height;
          setResizeCount(resizeCount + 1);
        }}
      />
    </div>
  );
}
