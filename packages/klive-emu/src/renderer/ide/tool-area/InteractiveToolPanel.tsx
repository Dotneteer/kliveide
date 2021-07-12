import * as React from "react";
import { ToolPanelBase } from "../ToolPanelBase";
import { ToolPanelDescriptorBase } from "./ToolAreaService";

const TITLE = "Interactive";

/**
 * Z80 registers panel
 */
export default class InteractiveToolPanel extends ToolPanelBase {
  title = TITLE;
}

/**
 * Descriptor for the sample side bar panel
 */
export class InteractiveToolPanelDescriptor extends ToolPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  createHeaderElement(): React.ReactNode {
    return (
      <div>
      </div>
    );
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <InteractiveToolPanel descriptor={this} />;
  }
}
