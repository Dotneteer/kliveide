import * as React from "react";
import { useEffect, useState } from "react";
import ScrollablePanel from "../../common-ui/ScrollablePanel";
import { IToolPanel, toolAreaService, ToolsInfo } from "./ToolAreaService";
import ToolTab from "./ToolTab";

/**
 * Represents the statusbar of the emulator
 */
export default function ToolTabBar() {
  // --- Component state
  const [activeTool, setActiveTool] = useState<IToolPanel | null>(null);
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
  let toolTabs: React.ReactNode[] = [];
  currentTools.forEach((d, index) => {
    toolTabs.push(
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

  // --- Component state
  return (
    <ScrollablePanel>
      {toolTabs}
    </ScrollablePanel>
  );
}
