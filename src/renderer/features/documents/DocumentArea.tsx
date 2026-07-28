import { useCallback, useEffect, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { DocumentsContainer } from "./DocumentsContainer";
import { DocumentsHeader } from "./DocumentsHeader";
import {
  DocumentHubServiceProvider,
  useDocumentHubServiceVersion
} from "@renderer/appIde/services/DocumentServiceProvider";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import styles from "./DocumentArea.module.scss";
import { useSelector } from "@renderer/core/RendererProvider";

/**
 * Hosts the active document hub, derives the active document snapshot, and mounts
 * the renderer for that document under the hub provider.
 */
export const DocumentArea = () => {
  const { projectService } = useAppServices();
  const documentHubService = projectService.getActiveDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion(documentHubService);
  const projectViewStateVersion = useSelector((s) => s.project?.projectViewStateVersion);
  const [activeDoc, setActiveDoc] = useState<ProjectDocumentState>(null);
  const [viewState, setViewState] = useState<any>(null);
  const [data, setData] = useState<string | Uint8Array>(null);

  // --- Manage saving and restoring state when the active index changes
  useEffect(() => {
    const doc = documentHubService?.getActiveDocument();
    if (doc) {
      const lockedDocs = projectService.getLockedFiles();
      // The hub owns document instances; keep the lock flag synchronized on that shared object.
      doc.isLocked = lockedDocs.includes(doc.id);
    }
    // Only update if doc ID actually changed to prevent unnecessary re-renders
    setActiveDoc((prevDoc) => {
      if (prevDoc?.id === doc?.id && prevDoc?.isLocked === doc?.isLocked) {
        return prevDoc;
      }
      return doc;
    });
    const viewState = documentHubService?.getDocumentViewState(doc?.id);
    setViewState(viewState);
    setData(doc?.contents);
  }, [documentHubService, hubVersion, projectService, projectViewStateVersion]);

  const activeDocId = activeDoc?.id;
  const activeDocEditPosition = activeDoc?.editPosition;

  // --- Memoize apiLoaded callback to prevent unnecessary re-renders
  const handleApiLoaded = useCallback(
    (api: DocumentApi) => {
      if (activeDocId) {
        documentHubService?.setDocumentApi(activeDocId, api);
        const position = activeDocEditPosition;
        if (
          position &&
          typeof (api as { setPosition?: (line: number, column: number) => void })?.setPosition ===
            "function"
        ) {
          (api as { setPosition: (line: number, column: number) => void }).setPosition(
            position.line,
            position.column
          );
        }
      }
    },
    [activeDocEditPosition, activeDocId, documentHubService]
  );

  return (
    <DocumentHubServiceProvider value={documentHubService}>
      <div className={styles.documentArea} tabIndex={-1}>
        <DocumentsHeader />
        {activeDoc && (
          <DocumentsContainer
            key={activeDoc.id}
            document={activeDoc}
            contents={data}
            viewState={viewState}
            apiLoaded={handleApiLoaded}
          />
        )}
      </div>
    </DocumentHubServiceProvider>
  );
};
