import { useEffect, useState } from "react";
import { useAppServices } from "../services/AppServicesProvider";
import { DocumentsContainer } from "./DocumentsContainer";
import { DocumentsHeader } from "./DocumentsHeader";
import {
  DocumentHubServiceProvider,
  useDocumentHubServiceVersion
} from "../services/DocumentServiceProvider";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import styles from "./DocumentArea.module.scss";
import { useSelector } from "@renderer/core/RendererProvider";

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
      doc.isLocked = lockedDocs.includes(doc.id);
    }
    setActiveDoc(doc);
    const viewState = documentHubService?.getDocumentViewState(doc?.id);
    setViewState(viewState);
    setData(doc?.contents);
  }, [hubVersion, projectViewStateVersion]);

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
            apiLoaded={(api) => {
              documentHubService.setDocumentApi(activeDoc.id, api);
            }}
          />
        )}
      </div>
    </DocumentHubServiceProvider>
  );
};
