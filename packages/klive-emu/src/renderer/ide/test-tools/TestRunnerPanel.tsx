import * as React from "react";
import { CSSProperties } from "styled-components";
import {
  ISideBarPanel,
  SideBarPanelDescriptorBase,
} from "../side-bar/SideBarService";

const TITLE = "Test Runner";

/**
 * Component properties
 */
type Props = {
  descriptor: ISideBarPanel;
};

/**
 * Z80 registers panel
 */
export default function TestRunnerPanel({ descriptor }: Props) {
  const placeholderStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    flexShrink: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "0.8em",
    color: "#a0a0a0",
  };

  return <div style={placeholderStyle}>{TITLE}</div>;
}

/**
 * Descriptor for the sample side bar panel
 */
export class TestRunnerPanelDescription extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <TestRunnerPanel descriptor={this} />;
  }
}
