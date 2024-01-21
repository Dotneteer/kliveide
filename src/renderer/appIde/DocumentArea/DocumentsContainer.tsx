import { documentPanelRegistry } from "@renderer/registry";
import { createElement } from "react";
import styles from "./DocumentsContainer.module.scss";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

/**
 * Properties to pass to a document renderer
 */
export type DocumentProps<T = any> = {
  document?: ProjectDocumentState;
  contents?: any;
  viewState?: T;
  apiLoaded?: (api: DocumentApi) => void;
};

export const DocumentsContainer = ({
  document,
  contents,
  viewState,
  apiLoaded
}: DocumentProps) => {
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
        {createElement<DocumentProps>(docRenderer.renderer, {
          document,
          contents,
          viewState,
          apiLoaded
        })}
      </div>
    ) : (
      <div className={styles.documentContainer}>Cannot find renderer</div>
    )
  ) : null;
};
