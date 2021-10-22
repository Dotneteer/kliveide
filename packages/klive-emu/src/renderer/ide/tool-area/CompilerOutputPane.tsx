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

  /**
   * Responds to an action of a highlighted item
   * @param data
   */
  onContentLineAction(data: unknown): void {
    console.log(`Action: ${JSON.stringify(data)}`);
  }
}
