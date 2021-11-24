import { BUILD_OUTPUT_PANE_ID } from "@abstractions/output-pane-service";
import { AssemblerErrorInfo } from "@abstractions/z80-compiler-service";
import { OutputPaneDescriptorBase } from "./OutputPaneService";
import { navigateToDocumentPosition } from "../document-area/document-utils";

const TITLE = "Build";

/**
 * Descriptor for the sample side bar panel
 */
export class CompilerOutputPanelDescriptor extends OutputPaneDescriptorBase {
  constructor() {
    super(BUILD_OUTPUT_PANE_ID, TITLE);
  }

  /**
   * Responds to an action of a highlighted item
   * @param data
   */
  async onContentLineAction(data: unknown): Promise<void> {
    if (!data) {
      return;
    }
    const errorItem = (data as any).errorItem as AssemblerErrorInfo;
    if (!errorItem) {
      return;
    }

   await navigateToDocumentPosition(
      errorItem.fileName,
      errorItem.line,
      errorItem.startColumn
    );
  }
}
