import * as React from "react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  ideToolFrameMaximizeAction,
  ideToolFrameShowAction,
} from "../../../shared/state/tool-frame-reducer";
import { AppState } from "../../../shared/state/AppState";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import CommandIconButton from "../command/CommandIconButton";
import { ideStore } from "../ideStore";
import { IToolPanel, toolAreaService, ToolsInfo } from "./ToolAreaService";
import ToolPropertyBar from "./ToolPropertyBar";
import ToolTab from "./ToolTab";
import ToolTabBar from "./ToolTabBar";
import { animationTick } from "../../common/utils";

/**
 * Represents the statusbar of the emulator
 */
export default function ToolFrame() {
  const headerHost = React.createRef<HTMLDivElement>();
  const mounted = useRef(false);

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
    <Root>
      <HeaderBar ref={headerHost}>
        <ToolTabBar />
        <ToolPropertyBar tool={activeTool} />
        <ToolCommandBar />
      </HeaderBar>
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
      <PlaceHolder key={activeTool?.index ?? -1}>
        {activeTool?.createContentElement()}
      </PlaceHolder>
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  background: "var(--shell-canvas-background-color)",
  others: {
    "border-top": "1px solid var(--panel-separator-border)",
  },
});

// --- Component helper tags
const HeaderBar = createSizedStyledPanel({
  height: 35,
  splitsVertical: false,
  fitToClient: true,
});

const PlaceHolder = createSizedStyledPanel({
  others: {
    overflow: "hidden",
  },
});

/**
 * Represents the statusbar of the emulator
 */
function ToolCommandBar() {
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
        clicked={() =>
          ideStore.dispatch(ideToolFrameMaximizeAction(!maximized))
        }
      />
      <CommandIconButton
        iconName="close"
        title="Close"
        clicked={() => ideStore.dispatch(ideToolFrameShowAction(false))}
      />
    </div>
  );
}
