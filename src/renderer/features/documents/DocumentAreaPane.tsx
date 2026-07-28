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
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";

type DocumentAreaPaneProps = {
  hub: IDocumentHubService;
  onActivated?: () => void;
};

/**
 * Hosts one document hub, derives its active document snapshot, and mounts the
 * renderer for that document under the hub provider.
 */
export const DocumentAreaPane = ({ hub, onActivated }: DocumentAreaPaneProps) => {
  const { projectService } = useAppServices();
  const hubVersion = useDocumentHubServiceVersion(hub);
  const projectViewStateVersion = useSelector((s) => s.project?.projectViewStateVersion);
  const [activeDoc, setActiveDoc] = useState<ProjectDocumentState>(null);
  const [viewState, setViewState] = useState<any>(null);
  const [data, setData] = useState<string | Uint8Array>(null);

  const activateHub = useCallback(() => {
    if (projectService.getActiveDocumentHubService() !== hub) {
      projectService.setActiveDocumentHubService(hub);
    }
    onActivated?.();
  }, [hub, onActivated, projectService]);

  // --- Manage saving and restoring state when the active index changes
  useEffect(() => {
    const doc = hub.getActiveDocument();
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
    const viewState = hub.getDocumentViewState(doc?.id);
    setViewState(viewState);
    setData(doc?.contents);
  }, [hub, hubVersion, projectService, projectViewStateVersion]);

  const activeDocId = activeDoc?.id;
  const activeDocEditPosition = activeDoc?.editPosition;

  // --- Memoize apiLoaded callback to prevent unnecessary re-renders
  const handleApiLoaded = useCallback(
    (api: DocumentApi) => {
      if (activeDocId) {
        hub.setDocumentApi(activeDocId, api);
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
    [activeDocEditPosition, activeDocId, hub]
  );

  return (
    <DocumentHubServiceProvider value={hub}>
      <div
        className={styles.documentArea}
        tabIndex={-1}
        onFocusCapture={activateHub}
        onPointerDownCapture={activateHub}
      >
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
