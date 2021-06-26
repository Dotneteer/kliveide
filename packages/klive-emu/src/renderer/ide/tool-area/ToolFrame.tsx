import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import ToolCommandBar from "./ToolCommandbar";
import ToolTabBar from "./ToolTabBar";

/**
 * Represents the statusbar of the emulator
 */
export default function ToolFrame() {
  return (
    <Root>
      <HeaderBar>
        <ToolTabBar />
        <ToolCommandBar />
      </HeaderBar>
      <PlaceHolder />
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  background: "var(--shell-canvas-background-color)",
  others: {
    "border-top": "1px solid var(--panel-separator-border)"
  }
});

// --- Component helper tags
const HeaderBar = createSizedStyledPanel({
  height: 35,
  splitsVertical: false,
  fitToClient: true,
});

const PlaceHolder = createSizedStyledPanel({});
