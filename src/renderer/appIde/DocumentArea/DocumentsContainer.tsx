import { documentPanelRegistry } from "@renderer/registry";
import { createElement } from "react";
import styles from "./DocumentsContainer.module.scss";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";

/**
 * Properties to pass to a document renderer
 */
export type DocumentProps = {
  document?: DocumentInfo;
  data?: any;
  apiLoaded: (api: DocumentApi) => void;
};

export const DocumentsContainer = ({ document, data, apiLoaded }: DocumentProps) => {
  // --- Get the document's renderer from the registry
  const docRenderer = documentPanelRegistry.find(
    dp => dp.id === document?.type
  );

  if (docRenderer) {
    document.iconName ||= docRenderer.icon;
    document.iconFill ||= docRenderer.iconFill;
  }

  return document ? (
    docRenderer ? (
      <div className={styles.documentContainer}>
        {createElement<DocumentProps>(docRenderer.renderer, { document, data, apiLoaded })}
      </div>
    ) : (
      <div className={styles.documentContainer}>Cannot find renderer</div>
    )
  ) : null;
};
