import * as React from "react";
import { SideBarPanelDescriptorBase } from "@services/SideBarService";
import { SideBarPanelBase } from "@components/SideBarPanelBase";

const TITLE = "Call Stack";

/**
 * Call stack panel
 */
export default class CallStackPanel extends SideBarPanelBase {
}

/**
 * Descriptor for the sample side bar panel
 */
export class CallStackPanelDescriptor extends SideBarPanelDescriptorBase {
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
    return <CallStackPanel descriptor={this} />;
  }
}
