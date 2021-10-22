import { IDocumentPanel } from "@abstractions/document-service";
import { ITreeNode, ProjectNode } from "@abstractions/project-node";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { GetFileContentsResponse } from "@core/messaging/message-types";
import { getDocumentService, getProjectService } from "@core/service-registry";

/**
 * Opens the specified resource
 * @param resource Resource name (full file path)
 * @param projNode Project node of the resource
 * @param isTemporary Open as a temporary document?
 */
export async function openNewDocument(
  resource: string,
  projNode?: ITreeNode<ProjectNode>,
  isTemporary = true,
  initialFocus = false
): Promise<IDocumentPanel> {
  // --- Find the project node
  if (!projNode) {
    projNode = getProjectService().searchNode(resource);
  }
  if (!projNode) {
    return null;
  }

  // --- Create a new document
  const documentService = getDocumentService();
  const factory = documentService.getResourceFactory(resource);
  if (factory) {
    const contentsResp = await sendFromIdeToEmu<GetFileContentsResponse>({
      type: "GetFileContents",
      name: resource,
    });
    const sourceText = contentsResp?.contents
      ? (contentsResp.contents as string)
      : "";
    let panel = await factory.createDocumentPanel(resource, sourceText);
    let index = documentService.getActiveDocument()?.index ?? null;
    panel.projectNode = projNode.nodeData;
    panel.temporary = isTemporary;
    panel.initialFocus = initialFocus;
    if (isTemporary) {
      const tempDocument = documentService.getTemporaryDocument();
      if (tempDocument) {
        index = tempDocument.index;
        documentService.unregisterDocument(tempDocument);
      }
    }
    return documentService.registerDocument(panel, true, index);
  }
}
