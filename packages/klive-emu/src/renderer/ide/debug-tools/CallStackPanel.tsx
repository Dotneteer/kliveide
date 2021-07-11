import * as React from "react";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase } from "../SideBarPanelBase";

const TITLE = "Call Stack";

/**
 * Call stack panel
 */
export default class CallStackPanel extends SideBarPanelBase {
  title = TITLE;
}

/**
 * Descriptor for the sample side bar panel
 */
export class CallStackPanelDescriptor extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <CallStackPanel descriptor={this} />;
  }
}
