import * as React from "react";
import { SplitContainer } from "../common/SplitContainer";
import EmulatorPanel from "./EmulatorPanel";
import { KeyboardPanel } from "./KeyboardPanel";

/**
 * Represents the main canvas of the emulator
 */
export class MainPanel extends React.Component {
  render() {
    return (
      <SplitContainer direction="vertical">
        <EmulatorPanel />
        <KeyboardPanel type="sp48" />
      </SplitContainer>
    );
  }
}
