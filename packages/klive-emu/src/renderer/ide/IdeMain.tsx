import * as React from "react";
import IdeDesk from "./IdeDesk";
import { createSizedStyledPanel } from "../common/PanelStyles";

/**
 * Represents the statusbar of the emulator
 */
export default function IdeMain() {
  return (
    <Root>
      <IdeDesk />
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  others: {
    outline: "none",
  },
});
