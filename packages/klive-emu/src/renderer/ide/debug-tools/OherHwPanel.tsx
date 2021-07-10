import * as React from "react";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase } from "../SideBarPanelBase";

const TITLE = "Other HW Info";

/**
 * Other hardware info panel
 */
export default class OtherHardwareInfoPanel extends SideBarPanelBase {
  title = TITLE;
}

/**
 * Descriptor for the sample side bar panel
 */
export class OtherHardwareInfoPanelDescriptor extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <OtherHardwareInfoPanel descriptor={this} />;
  }
}
