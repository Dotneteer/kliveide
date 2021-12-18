import * as React from "react";
import { useEffect, useRef, useState } from "react";

import {
  getContextMenuService,
  getSideBarService,
  getStore,
} from "@core/service-registry";
import { animationTick } from "@components/component-utils";
import { AppState } from "@state/AppState";
import { ISideBarPanel } from "@abstractions/side-bar-service";
import { MenuItem } from "@abstractions/command-definitions";
import SideBarPanelHeader from "./SideBarPanelHeader";
import { useResizeObserver } from "@components/useResizeObserver";

/**
 * Component properties
 */
type Props = {
  descriptor: ISideBarPanel;
  index: number;
  isLast: boolean;
  sizeable: boolean;
  heightPercentage: number;
  visibilityChanged: (index: number) => void;
  startResize: (index: number) => void;
  resized: (delta: number) => void;
};

/**
 * Represents a panel of the side bar
 * A side bar panel is composed from a header and a content panel. The header
 * allows expanding or collapsing the panel, and provides a resizing grip.
 */
export const SideBarPanel: React.VFC<Props> = ({
  descriptor,
  index,
  isLast,
  sizeable,
  visibilityChanged,
  startResize,
  resized,
}) => {
  const hostElement = useRef<HTMLDivElement>();
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
      await new Promise((r) => setTimeout(r, 200));
      setExpanded(descriptor.expanded);
      setRefreshCount(refreshCount + 1);
    }
  };

  useEffect(() => {
    getStore().stateChanged.on(onStateChange);
    return () => {
      getStore().stateChanged.off(onStateChange);
    };
  });

  useEffect(() => {
    // --- Get the initial width
    if (hostElement.current) {
      descriptor.height = hostElement.current.offsetHeight;
    }
  });

  useResizeObserver(hostElement, (entries) => {
    descriptor.height = entries[0].contentRect.height;
    setRefreshCount(refreshCount + 1);
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
    </div>
  );
};
