import * as React from "react";
import { useEffect, useState } from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import { IToolPanel, toolAreaService, ToolsInfo } from "./ToolAreaService";
import ToolCommandBar from "./ToolCommandbar";
import ToolPropertyBar from "./ToolPropertyBar";
import ToolTab from "./ToolTab";
import ToolTabBar from "./ToolTabBar";

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

const PlaceHolder = createSizedStyledPanel({});
