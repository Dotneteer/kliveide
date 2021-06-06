import * as React from "react";
import { createSizedStyledPanel } from "../common/PanelStyles";

/**
 * Component properties
 */
interface Props {
  initialSize?: number;
}

/**
 * Represents the statusbar of the emulator
 */
export default function IdeOutputFrame(props: Props) {
  return <Root data-initial-size={props.initialSize}></Root>;
}

// --- Helper component tags
const Root = createSizedStyledPanel({
  background: "var(--shell-canvas-background-color)",
  others: {
    overflow: "hidden",
    "border-top": "1px solid var(--panel-separator-border)",
  },
});
