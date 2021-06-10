import * as React from "react";
import ActivityBar from "./activity-bar/ActivityBar";
import SideBar from "./side-bar/SideBar";
import IdeMain from "./IdeMain";
import { SplitContainer } from "../common/SplitContainer";
import { animationTick } from "../common/utils";
import { createSizedStyledPanel } from "../common/PanelStyles";
import { useState } from "react";

/**
 * Represents the main canvas of the emulator
 */
export default function IdeWorkbench() {
  const [refreshKey, setRefreshKey] = useState(0);

  React.useEffect(() => {
    // --- Refresh the component after the first animation tick
    (async () => {
      await animationTick();
      setRefreshKey(1);
    })();
  });

  return (
    <Root>
      <ActivityBar />
      <SplitContainer direction="horizontal" refreshTag={refreshKey}>
        <SideBar />
        <IdeMain />
      </SplitContainer>
    </Root>
  );
}

// --- Helper component tags
const Root = createSizedStyledPanel({
  fitToClient: true,
  splitsVertical: false,
  others: {
    "background-color": "var(--emulator-background-color)",
  },
});
