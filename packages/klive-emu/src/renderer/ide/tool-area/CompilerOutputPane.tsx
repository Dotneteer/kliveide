import { COMPILER_OUTPUT_PANE_ID } from "@abstractions/output-pane-service";
import { getDocumentService } from "@core/service-registry";
import { AssemblerErrorInfo } from "@abstractions/z80-compiler-service";
import { OutputPaneDescriptorBase } from "./OutputPaneService";
import { openNewDocument } from "../document-area/document-utils";

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
  async onContentLineAction(data: unknown): Promise<void> {
    if (!data) {
      return;
    }
    const errorItem = (data as any).errorItem as AssemblerErrorInfo;
    if (!errorItem) {
      return;
    }

    const documentService = getDocumentService();
    const document = documentService.getDocumentById(errorItem.fileName);
    console.log(errorItem.fileName);
    if (document) {
      document.temporary = false;
      documentService.setActiveDocument(document);
      document.navigateToLocation({
        line: errorItem.line,
        column: errorItem.startColumn,
      });
    } else {
      const newDocument = await openNewDocument(
        errorItem.fileName,
        undefined,
        false,
        true
      );
      newDocument.navigateToLocation({
        line: errorItem.line,
        column: errorItem.startColumn,
      });
    }
  }
}
