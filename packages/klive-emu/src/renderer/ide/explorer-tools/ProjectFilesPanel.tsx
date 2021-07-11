import * as React from "react";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase } from "../SideBarPanelBase";

const TITLE = "Project Files";

/**
 * Project files panel
 */
export default class ProjectFilesPanel extends SideBarPanelBase {
  title = TITLE;
}

/**
 * Descriptor for the sample side bar panel
 */
export class ProjectFilesPanelDescriptor extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <ProjectFilesPanel descriptor={this} />;
  }
}
