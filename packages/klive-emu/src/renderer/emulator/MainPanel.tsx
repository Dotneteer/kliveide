import * as React from "react";
import { SplitContainer } from "../common/SplitContainer";

/**
 * Represents the main canvas of the emulator
 */
export class MainPanel extends React.Component {
  render() {
    return (
      <SplitContainer>
        <div
          style={{ background: "grey", width: "100%", height: "100%" }}
        ></div>
        <div
          style={{ background: "darkgrey", width: "100%", height: "100%" }}
        ></div>
      </SplitContainer>
    );
  }
}
