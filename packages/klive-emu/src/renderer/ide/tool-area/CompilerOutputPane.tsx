import { COMPILER_OUTPUT_PANE_ID } from "@abstractions/output-pane-service";
import { OutputPaneDescriptorBase } from "./OutputPaneService";

const TITLE = "Z80 Assembler";

/**
 * Descriptor for the sample side bar panel
 */
export class CompilerOutputPanelDescriptor extends OutputPaneDescriptorBase {
  constructor() {
    super(COMPILER_OUTPUT_PANE_ID, TITLE);
  }
}
