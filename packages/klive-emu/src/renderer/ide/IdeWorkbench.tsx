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

const sideBar = () => <SideBar />;
const ideMain = () => <IdeMain />;

/**
 * Represents the main canvas of the emulator
 */
export default function IdeWorkbench() {
  return (
    <Root>
      <ActivityBar />
      <SplitterComponent separatorSize={2}>
        <PanesDirective>
          <PaneDirective
            cssClass="splitter-panel"
            content={sideBar}
            size="20%"
            min="5%"
            max="75%"
          />
          <PaneDirective
            cssClass="splitter-panel"
            content={ideMain}
            size="80%"
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
