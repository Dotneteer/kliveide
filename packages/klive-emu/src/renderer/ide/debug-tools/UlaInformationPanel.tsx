import * as React from "react";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase } from "../SideBarPanelBase";

const TITLE = "ULA Information";

/**
 * ULA information panel
 */
export default class UlaInformationPanel extends SideBarPanelBase {
  title = TITLE;
}

/**
 * Descriptor for the sample side bar panel
 */
export class UlaInformationPanelDescriptor extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <UlaInformationPanel descriptor={this} />;
  }
}
