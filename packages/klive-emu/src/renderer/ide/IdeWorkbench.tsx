import * as React from "react";
import {
  PaneDirective,
  PanesDirective,
  SplitterComponent,
} from "@syncfusion/ej2-react-layouts";
import ActivityBar from "./activity-bar/ActivityBar";
import SideBar from "./side-bar/SideBar";
import IdeMain from "./IdeMain";
import { createSizedStyledPanel } from "../common/PanelStyles";

/**
 * Represents the main canvas of the emulator
 */
export default function IdeWorkbench() {

  return (
    <Root>
      <ActivityBar />
      <SplitterComponent id="splitter" separatorSize={0}>
        <PanesDirective>
          <PaneDirective
            cssClass="splitter-panel-vertical"
            content={() => <SideBar />}
            size="10%"
            min="5%"
            max="75%"
          />
          <PaneDirective
            cssClass="splitter-panel-vertical"
            content={() => <IdeMain />}
            size="90%"
            min="5%"
            max="95%"
          />
        </PanesDirective>
      </SplitterComponent>
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
