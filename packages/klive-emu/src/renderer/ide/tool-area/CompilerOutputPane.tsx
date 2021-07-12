import { OutputPaneDescriptorBase } from "./OutputPaneService";

const ID = "CompilerOuputPane";
const TITLE = "Z80 Assembler";

/**
 * Descriptor for the sample side bar panel
 */
export class CompilerOutputPanelDescriptor extends OutputPaneDescriptorBase {
  constructor() {
    super(ID, TITLE);
  }
}
