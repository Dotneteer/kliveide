import { documentPanelRegistry } from "@renderer/registry";
import { memo } from "react";
import { useT } from "@common/i18n/useT";
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

/**
 * Selects the registered renderer for the active document and mounts it with the
 * document contents, view state, and renderer API callback.
 */
const DocumentsContainerComponent = ({
  document,
  contents,
  viewState,
  apiLoaded
}: DocumentProps) => {
  const t = useT();
  // --- Get the document's renderer from the registry
  const docRenderer = documentPanelRegistry.find((dp) => dp.id === document?.type);

  // Render the component directly instead of using createElement
  // This ensures React properly tracks component identity
  const RendererComponent = docRenderer?.renderer;

  return document ? (
    RendererComponent ? (
      <div className={styles.documentContainer}>
        <RendererComponent
          document={document}
          contents={contents}
          viewState={viewState}
          apiLoaded={apiLoaded}
        />
      </div>
    ) : (
      <div className={styles.documentContainer}>{t("documents.container.noRenderer")}</div>
    )
  ) : null;
};

export const DocumentsContainer = memo(DocumentsContainerComponent, (prevProps, nextProps) => {
  return (
    prevProps.document?.id === nextProps.document?.id &&
    prevProps.document?.type === nextProps.document?.type &&
    prevProps.contents === nextProps.contents &&
    prevProps.viewState === nextProps.viewState &&
    prevProps.apiLoaded === nextProps.apiLoaded
  );
});
