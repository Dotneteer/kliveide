import * as React from "react";
import { useSelector } from "react-redux";

import { dispatch } from "@core/service-registry";
import { AppState } from "@state/AppState";
import { emuKeyboardHeightAction } from "@state/emulator-panel-reducer";
import { getVmEngineService } from "@modules-core/vm-engine-service";
import { EmulatorPanel } from "./EmulatorPanel";
import { KeyboardPanel } from "./KeyboardPanel";
import { Fill, Row } from "@components/Panels";
import { SplitPanel } from "@components/SplitPanel";

/**
 * Represents the main canvas of the emulator
 */
export default function MainPanel() {
  // --- App state bindings
  const vmEngineService = getVmEngineService();
  const type = useSelector((s: AppState) =>
    vmEngineService.hasEngine ? vmEngineService.getEngine().keyboardType : null
  );
  const showKeyboard = useSelector(
    (s: AppState) => s.emuViewOptions.showKeyboard
  );
  const keyboardHeight = useSelector((s: AppState) =>
    s.emulatorPanel.keyboardHeight
      ? `${s.emulatorPanel.keyboardHeight}px`
      : "33%"
  );

  return (
    <Fill>
      <SplitPanel
        splitterSize={4}
        horizontal={false}
        reverse={true}
        showPanel1={showKeyboard}
        panel1MinSize={120}
        panel2MinSize={320}
        initialSize={keyboardHeight ?? "33%"}
        panel2={<EmulatorPanel />}
        panel1={
          <Row>
            <KeyboardPanel type={type} />
          </Row>
        }
        resized={(newPos) => {
          dispatch(emuKeyboardHeightAction(newPos));
        }}
      />
    </Fill>
  );
}
