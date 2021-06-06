import * as React from "react";
import { createSizedStyledPanel } from "../common/PanelStyles";
import DocumentTabBar from "./DocumentTabBar";

/**
 * Component props
 */
interface Props {
  initialSize?: number;
}

/**
 * Represents the statusbar of the emulator
 */
export default function IdeDocumentFrame(props: Props) {
  return (
    <Root data-initial-size={props.initialSize}>
      <DocumentTabBar />
      <PlaceHolder />
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  background: "var(--shell-canvas-background-color)",
  others: {
    "border-top": "1px solid var(--panel-separator-border)",
    "border-right": "1px solid var(--panel-separator-border)",
  },
});

const PlaceHolder = createSizedStyledPanel({});
