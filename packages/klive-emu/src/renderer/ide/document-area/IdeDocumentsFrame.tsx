import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import DocumentTabBar from "./DocumentTabBar";
import CommandBar from "./CommandBar";

/**
 * Represents the statusbar of the emulator
 */
export default function IdeDocumentFrame() {
  return (
    <Root>
      <HeaderBar>
        <DocumentTabBar />
        <CommandBar />
      </HeaderBar>
      <PlaceHolder />
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  background: "var(--shell-canvas-background-color)",
});

// --- Component helper tags
const HeaderBar = createSizedStyledPanel({
  height: 35,
  splitsVertical: false,
  fitToClient: true,
});

const PlaceHolder = createSizedStyledPanel({
  others: {
    background: "#404040"
  }
});
