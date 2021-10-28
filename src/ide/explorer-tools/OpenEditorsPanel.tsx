import * as React from "react";
import { SideBarPanelDescriptorBase } from "../../common-ui/services/SideBarService";
import { SideBarPanelBase } from "../../common-ui/components/SideBarPanelBase";

const TITLE = "Open Editors";

/**
 * Open editors panel
 */
export default class OpenEditorsPanel extends SideBarPanelBase {}

/**
 * Descriptor for the sample side bar panel
 */
export class OpenEditorsPanelDescriptor extends SideBarPanelDescriptorBase {
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
    return <OpenEditorsPanel descriptor={this} />;
  }
}
