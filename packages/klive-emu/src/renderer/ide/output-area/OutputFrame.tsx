import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";

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
      <PlaceHolder />
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  background: "var(--shell-canvas-background-color)",
  // others: {
  //   "border-top": "1px solid var(--panel-separator-border)",
  //   "border-right": "1px solid var(--panel-separator-border)",
  // },
});

const PlaceHolder = createSizedStyledPanel({});
