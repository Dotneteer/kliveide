import * as React from "react";

import { createSizedStyledPanel } from "../../common/PanelStyles";

/**
 * Represents the statusbar of the emulator
 */
export default function DocumentTabBar() {
  return <Root></Root>;
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  height: "100%",
  splitsVertical: true,
  fitToClient: true,
});
