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

const ideDocumentsFrame = () => <IdeDocumentsFrame />;
const toolFrame = () => <ToolFrame />;

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
      <SplitterComponent orientation="Vertical" separatorSize={2}>
        <PanesDirective>
          {!toolsMaximized && (
            <PaneDirective
              key="documents"
              cssClass="splitter-panel"
              content={ideDocumentsFrame}
              size="66%"
              min="120px"
              max="90%"
            />
          )}
          {toolsVisible && (
            <PaneDirective
              key="tools"
              cssClass="splitter-panel"
              content={toolFrame}
              size="34%"
              min="120px"
              max="90%"
            />
          )}
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
