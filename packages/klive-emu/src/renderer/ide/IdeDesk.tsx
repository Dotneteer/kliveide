import * as React from "react";
import {
  PaneDirective,
  PanesDirective,
  SplitterComponent,
} from "@syncfusion/ej2-react-layouts";

import { GutterDirection, SplitContainer } from "../common/SplitContainer";
import { animationTick } from "../common/utils";
import { createSizedStyledPanel } from "../common/PanelStyles";
import { useState } from "react";
import IdeDocumentsFrame from "./document-area/IdeDocumentsFrame";
import OutputFrame from "./output-area/OutputFrame";

interface Props {
  direction?: GutterDirection;
}

/**
 * Represents the main canvas of the IDE
 */
export default function IdeDesk(props: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  React.useEffect(() => {
    (async() => {
      await animationTick();
      setRefreshKey(1);
    })()
  });

  return (
    <Root>
      <SplitContainer
        direction={props.direction ?? "vertical"}
        refreshTag={refreshKey}
      >
        <IdeDocumentsFrame />
        <OutputFrame initialSize={200} />
      </SplitContainer>
    </Root>
  );
}

// --- Helper component tags
const Root = createSizedStyledPanel({
  fitToClient: true,
  background: "var(--emulator-background-color)",
});
