import * as React from "react";
import {
  PaneDirective,
  PanesDirective,
  SplitterComponent,
} from "@syncfusion/ej2-react-layouts";

import { useSelector } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import EmulatorPanel from "./EmulatorPanel";
import KeyboardPanel from "./KeyboardPanel";
import { vmEngineService } from "../machines/core/vm-engine-service";
import { emuKeyboardHeightAction } from "../../shared/state/emulator-panel-reducer";
import styles from "styled-components";
import { dispatch } from "../../abstractions/service-helpers";

/**
 * Represents the main canvas of the emulator
 */
export default function MainPanel() {
  // --- App state bindings
  const type = useSelector((s: AppState) =>
    vmEngineService.hasEngine ? vmEngineService.getEngine().keyboardType : null
  );
  const showKeyboard = useSelector(
    (s: AppState) => s.emuViewOptions.showKeyboard
  );
  const keyboardHeight = useSelector((s: AppState) =>
    s.emulatorPanel.keyboardHeight
      ? `${s.emulatorPanel.keyboardHeight}px`
      : undefined
  );

  let lastShowKeyboard = false;
  let delayIsOver = true;

  if (lastShowKeyboard !== showKeyboard) {
    lastShowKeyboard = showKeyboard;
    if (lastShowKeyboard) {
      delayIsOver = true;
    }
  }

  const handleResizing = (children: number[]) => {
    if (children.length > 0) {
      const height = children[children.length - 1];
      dispatch(emuKeyboardHeightAction(height));
    }
  };

  return (
    <Root>
      <SplitterComponent
        orientation="Vertical"
        separatorSize={2}
        resizeStop={(arg) => handleResizing(arg.paneSize)}
      >
        <PanesDirective>
          <PaneDirective
            cssClass="splitter-panel"
            content={() => <EmulatorPanel />}
            min="80px"
          />
          {showKeyboard && (
            <PaneDirective
              cssClass="splitter-panel"
              size={keyboardHeight ?? "50%"}
              min="120px"
              content={() => <KeyboardPanel type={type} />}
            />
          )}
        </PanesDirective>
      </SplitterComponent>
    </Root>
  );
}

// --- Helper component tags
const Root = styles.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  flex-shrink: 1;
  width: 100%;
  background-color: var(--emulator-background-color);
`;
