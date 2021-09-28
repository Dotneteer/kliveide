import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import { useEffect, useState } from "react";
import { animationTick } from "../../common-ui/utils";
import SideBarPanelHeader from "./SideBarPanelHeader";
import { getSideBarService } from "@abstractions/service-helpers";
import { MenuItem } from "../../../shared/command/commands";
import { getContextMenuService } from "@abstractions/service-helpers";
import { AppState } from "@state/AppState";
import { getStore } from "@abstractions/service-helpers";
import { ISideBarPanel } from "../../../shared/services/ISidebarService";

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
  const [refreshCount, setRefreshCount] = useState(0);

  const sideBarService = getSideBarService();
  
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

  // --- The descriptor can respond to state changes
  const onStateChange = async (state: AppState) => {
    await descriptor.onStateChange(state);
    if (await descriptor.shouldUpdatePanelHeader()) {
      await new Promise(r => setTimeout(r, 200));
      setExpanded(descriptor.expanded);
      setRefreshCount(refreshCount + 1);
    }
  };

  useEffect(() => {
    getStore().stateChanged.on(onStateChange);
    return () => {
      getStore().stateChanged.off(onStateChange);
    }
  });

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
        clicked={() => {
          const newExpanded = !expanded;
          setExpanded(newExpanded);
          descriptor.expanded = newExpanded;
          visibilityChanged(index);
        }}
        rightClicked={async (e) => {
          await getContextMenuService().openMenu(
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
          setRefreshCount(refreshCount + 1);
        }}
      />
    </div>
  );
}
