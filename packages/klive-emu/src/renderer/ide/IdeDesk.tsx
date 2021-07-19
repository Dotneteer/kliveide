import * as React from "react";
import {
  PaneDirective,
  PanesDirective,
  SplitterComponent,
} from "@syncfusion/ej2-react-layouts";

import { createSizedStyledPanel } from "../common/PanelStyles";
import IdeDocumentsFrame from "./document-area/IdeDocumentsFrame";
import ToolFrame from "./tool-area/ToolFrame";
import { useSelector } from "react-redux";
import { AppState } from "../../shared/state/AppState";

/**
 * Represents the main canvas of the IDE
 */
export default function IdeDesk() {
  const toolsMaximized = useSelector(
    (state: AppState) => state.toolFrame?.maximized ?? false
  );
  const toolsVisible = useSelector(
    (state: AppState) => state.toolFrame?.visible ?? false
  );

  return (
    <Root>
      {toolsVisible && !toolsMaximized && (
        <SplitterComponent orientation="Vertical" separatorSize={2}>
          <PanesDirective>
            <PaneDirective
              key="documents"
              cssClass="splitter-panel"
              content={() => <IdeDocumentsFrame />}
              size="66%"
              min="120px"
              max="90%"
            />
            <PaneDirective
              key="tools"
              cssClass="splitter-panel"
              content={() => <ToolFrame />}
              size="34%"
              min="120px"
              max="90%"
            />
          </PanesDirective>
        </SplitterComponent>
      )}
      {toolsVisible && toolsMaximized && <ToolFrame />}
      {!toolsVisible && <IdeDocumentsFrame />}
    </Root>
  );
}

// --- Helper component tags
const Root = createSizedStyledPanel({
  fitToClient: true,
  background: "var(--emulator-background-color)",
});
