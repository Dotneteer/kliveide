import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import OutputCommandBar from "./OutputCommandbar";
import OutputTabBar from "./OutputTabBar";

/**
 * Component props
 */
interface Props {
  initialSize?: number;
}

/**
 * Represents the statusbar of the emulator
 */
export default function OutputFrame(props: Props) {
  return (
    <Root data-initial-size={props.initialSize}>
      <HeaderBar>
        <OutputTabBar />
        <OutputCommandBar />
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

const PlaceHolder = createSizedStyledPanel({});
