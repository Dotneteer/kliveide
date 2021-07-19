import * as React from "react";
import { CSSProperties, useEffect, useState } from "react";
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
  // --- Component state
  const [activeTool, setActiveTool] = useState<IToolPanel | null>(
    toolAreaService.getActiveTool()
  );
  const [currentTools, setCurrentTools] = useState<IToolPanel[]>([]);

  // --- Refresh the documents when any changes occur
  const refreshDocs = (info: ToolsInfo) => {
    setCurrentTools(info.tools);
    setActiveTool(info.active);
  };

  useEffect(() => {
    // --- Mount
    setCurrentTools(toolAreaService.getTools());
    setActiveTool(toolAreaService.getActiveTool());
    toolAreaService.toolsChanged.on(refreshDocs);

    return () => {
      // --- Unmount
      toolAreaService.toolsChanged.off(refreshDocs);
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
      <HeaderBar>
        <ToolTabBar />
        <ToolPropertyBar tool={activeTool} />
        <ToolCommandBar />
      </HeaderBar>
      <PlaceHolder key={activeTool.index}>
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
    "overflow": "hidden",
  }
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
    paddingLeft: "6px",
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
        clicked={async () => {
          const toolsMaximized = !!ideStore.getState().toolFrame?.maximized;
          if (toolsMaximized) {
            ideStore.dispatch(ideToolFrameMaximizeAction(false));
            await animationTick();
          }
          ideStore.dispatch(ideToolFrameShowAction(false));
          if (toolsMaximized) {
            await animationTick();
            ideStore.dispatch(ideToolFrameMaximizeAction(true));
          }
        }}
      />
    </div>
  );
}
