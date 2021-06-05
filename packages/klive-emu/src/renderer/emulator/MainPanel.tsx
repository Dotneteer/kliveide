import * as React from "react";
import { useSelector } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { SplitContainer } from "../common/SplitContainer";
import EmulatorPanel from "./EmulatorPanel";
import { emuStore } from "./emuStore";
import KeyboardPanel from "./KeyboardPanel";
import { vmEngineService } from "../machines/vm-engine-service";
import { emuKeyboardHeightAction } from "../../shared/state/emulator-panel-reducer";
import styles from "styled-components";

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
  return (
    <Root>
      <SplitContainer
        direction="vertical"
        refreshTag={!!showKeyboard}
        splitterMoved={handleMoved}
      >
        <EmulatorPanel />
        <KeyboardPanel
          initialHeight={keyboardHeight}
          type={type}
          showPanel={delayIsOver}
        />
      </SplitContainer>
    </Root>
  );

  function handleMoved(children: NodeListOf<HTMLDivElement>): void {
    if (children.length > 0) {
      const height = children[children.length - 1].offsetHeight;
      emuStore.dispatch(emuKeyboardHeightAction(height));
    }
  }
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

