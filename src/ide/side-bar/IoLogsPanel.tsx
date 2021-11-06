import * as React from "react";

import { ISideBarPanel } from "@abstractions/side-bar-service";
import { SideBarPanelDescriptorBase } from "@services/SideBarService";
import { CSSProperties } from "react";

const TITLE = "I/O Operations";

/**
 * Component properties
 */
type Props = {
  descriptor: ISideBarPanel;
};

/**
 * Z80 registers panel
 */
export default function IoLogsPanel({ descriptor }: Props) {
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
export class IoLogsPanelDescription extends SideBarPanelDescriptorBase {
  /**
   * Panel title
   */
  get title(): string {
    return TITLE;
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <IoLogsPanel descriptor={this} />;
  }
}
