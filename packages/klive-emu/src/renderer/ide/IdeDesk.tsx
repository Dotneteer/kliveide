import * as React from "react";
import {
  PaneDirective,
  PanesDirective,
  SplitterComponent,
} from "@syncfusion/ej2-react-layouts";

import { createSizedStyledPanel } from "../common/PanelStyles";
import IdeDocumentsFrame from "./document-area/IdeDocumentsFrame";
import OutputFrame from "./output-area/OutputFrame";
import { useSelector } from "react-redux";
import { AppState } from "../../shared/state/AppState";

/**
 * Represents the main canvas of the IDE
 */
export default function IdeDesk() {
  const outputMaximized = useSelector(
    (state: AppState) => state.outputFrame?.maximized ?? false
  );

  return (
    <Root>
      <SplitterComponent orientation="Vertical" separatorSize={2}>
        <PanesDirective>
          {!outputMaximized && (
            <PaneDirective
              cssClass="splitter-panel"
              content={() => <IdeDocumentsFrame />}
              size="66%"
              min="80px"
              max="95%"
            />
          )}
          <PaneDirective
            cssClass="splitter-panel"
            content={() => <OutputFrame />}
            size="34%"
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
  background: "var(--emulator-background-color)",
});
