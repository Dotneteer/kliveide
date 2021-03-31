import * as React from "react";
import { DividerBox } from "../common/DividerBox";

/**
 * Represents the main canvas of the emulator
 */
export class MainPanel extends React.Component {
  render() {
    return <div className="main-panel">
      <div className="upper"></div>
      <DividerBox />
      <div className="lower"></div>
    </div>;
  }
}
