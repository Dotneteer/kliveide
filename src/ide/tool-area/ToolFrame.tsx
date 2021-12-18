import * as React from "react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { dispatch, getToolAreaService } from "@core/service-registry";
import {
  ideToolFrameMaximizeAction,
  ideToolFrameShowAction,
} from "@state/tool-frame-reducer";
import { AppState } from "@state/AppState";
import { IToolPanel, ToolsInfo } from "@abstractions/tool-area-service";
import { CommandIconButton } from "../context-menu/CommandIconButton";
import { ToolPropertyBar } from "./ToolPropertyBar";
import { ToolTab } from "./ToolTab";
import { ToolTabBar } from "./ToolTabBar";

/**
 * Represents the statusbar of the emulator
 */
export const ToolFrame: React.VFC = () => {
  const headerHost = useRef<HTMLDivElement>();
  const mounted = useRef(false);
  const toolAreaService = getToolAreaService();

  // --- Component state
  const [activeTool, setActiveTool] = useState<IToolPanel | null>(
    toolAreaService.getActiveTool()
  );
  const [currentTools, setCurrentTools] = useState<IToolPanel[]>([]);
  const [showDecorator, setShowDecorator] = useState(false);

  // --- Refresh the documents when any changes occur
  const refreshDocs = (info: ToolsInfo) => {
    setCurrentTools(info.tools);
    setActiveTool(info.active);
  };

  const onScroll = (pos: number) => {
    setShowDecorator(pos > 0);
  };

  useEffect(() => {
    // --- Mount
    if (!mounted.current) {
      mounted.current = true;
      toolAreaService.toolsChanged.on(refreshDocs);
      toolAreaService.activePaneScrolled.on(onScroll);
    }

    return () => {
      // --- Unmount
      toolAreaService.activePaneScrolled.off(onScroll);
      toolAreaService.toolsChanged.off(refreshDocs);
      mounted.current = false;
    };
  });

  // --- Create the list of visible documents
  let documentTabs: React.ReactNode[] = [];
  currentTools.forEach((d, index) => {
    documentTabs.push(
      <ToolTab
        title={d.title}
        active={d === activeTool}
        key={index}
        index={index}
        tool={d}
        isLast={index >= currentTools.length - 1}
        clicked={() => {
          if (activeTool !== d) {
            toolAreaService.setActiveTool(d);
          }
        }}
      />
    );
  });

  return (
    <div style={rootStyle}>
      <div style={headerBarStyle} ref={headerHost}>
        <ToolTabBar />
        <ToolPropertyBar tool={activeTool} />
        <ToolCommandBar />
      </div>
      <div
        style={{
          position: "relative",
          top: 0,
          left: 0,
          width: "100%",
          height: 6,
          boxShadow: showDecorator ? "#000000 0 6px 6px -6px inset" : "none",
          zIndex: 10,
        }}
      ></div>
      <div style={placeHolderStyle} key={activeTool?.index ?? -1}>
        {activeTool?.createContentElement()}
      </div>
    </div>
  );
};

const rootStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flexShrink: 1,
  flexGrow: 1,
  width: "100%",
  height: "100%",
  backgroundColor: "var(--shell-canvas-background-color)",
  borderTop: "1px solid var(--panel-separator-border)",
};

const headerBarStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  flexShrink: 1,
  flexGrow: 1,
  width: "100%",
  height: 35,
};

const placeHolderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flexShrink: 1,
  flexGrow: 1,
  width: "100%",
  height: "100%",
  overflow: "hidden",
};

/**
 * Represents the statusbar of the emulator
 */
const ToolCommandBar: React.VFC = () => {
  const maximized = useSelector(
    (state: AppState) => state.toolFrame?.maximized ?? false
  );

  const style: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    width: "auto",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: "6px",
    background: "var(--shell-canvas-background-color)",
  };

  return (
    <div style={style}>
      <CommandIconButton
        iconName={maximized ? "chevron-down" : "chevron-up"}
        title={maximized ? "Restore panel size" : "Maximize panel size"}
        clicked={() => dispatch(ideToolFrameMaximizeAction(!maximized))}
      />
      <CommandIconButton
        iconName="close"
        title="Close"
        clicked={() => dispatch(ideToolFrameShowAction(false))}
      />
    </div>
  );
};
