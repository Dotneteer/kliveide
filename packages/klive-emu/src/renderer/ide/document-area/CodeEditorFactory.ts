import { EditorDocumentPanelDescriptor } from "../editor/EditorDocument";
import { IDocumentFactory, IDocumentPanel } from "./DocumentFactory";

/**
 * Creates a code editor factory that uses a particular language
 */
export class CodeEditorFactory implements IDocumentFactory {
  /**
   * Initializes the code editor to use the specified language
   * @param language Language identifier
   */
  constructor(public readonly language: string) {}

  /**
   * Creates a document panel
   * @param resource Resosurce name
   * @param contents Contents of the document
   */
  createDocumentPanel(
    resource: string,
    contents: string | Buffer
  ): IDocumentPanel {
    // --- Get the field name from the full resource name
    const parts = resource.split("/");
    const filename = parts.length > 0 ? parts[parts.length - 1] : "";
    return new EditorDocumentPanelDescriptor(
      resource,
      filename,
      this.language,
      contents.toString()
    );
  }
}