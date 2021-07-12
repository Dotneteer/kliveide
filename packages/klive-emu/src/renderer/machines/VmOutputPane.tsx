import { OutputPaneDescriptorBase } from "../ide/tool-area/OutputPaneService";

const ID = "VmOuputPane";
const TITLE = "Virtual Machine";

/**
 * Descriptor for the sample side bar panel
 */
export class VmOutputPanelDescriptor extends OutputPaneDescriptorBase {
  constructor() {
    super(ID, TITLE);
  }
}
