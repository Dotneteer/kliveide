import { documentPanelRegistry } from "@renderer/registry";
import { createElement } from "react";
import styles from "./DocumentsContainer.module.scss";
import { DocumentInfo } from "@abstractions/DocumentInfo";

/**
 * Properties to pass to a document renderer
 */
export type DocumentProps = {
  document?: DocumentInfo;
  data?: any;
};

export const DocumentsContainer = ({ document, data }: DocumentProps) => {
  // --- Get the document's renderer from the registry
  const docRenderer = documentPanelRegistry.find(
    dp => dp.id === document?.type
  );

  if (docRenderer) {
    document.iconName ||= docRenderer.icon;
    document.iconFill ||= docRenderer.iconFill
  }

  return document ? (
    docRenderer ? (
      createElement<DocumentProps>(docRenderer.renderer, {document, data})
    ) : (
      <div className={styles.documentContainer}>Cannot find renderer</div>
    )
  ) : null;
};
