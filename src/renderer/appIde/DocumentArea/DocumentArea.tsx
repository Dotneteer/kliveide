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
  const projectViewStateVersion = useSelector(s => s.project?.projectViewStateVersion);
  const [activeDoc, setActiveDoc] = useState<ProjectDocumentState>(null);

  // --- Manage saving and restoring state when the active index changes
  useEffect(() => {
    setActiveDoc(documentHubService?.getActiveDocument());
  }, [hubVersion, projectViewStateVersion]);

  const data = activeDoc?.contents;
  const viewState = documentHubService.getDocumentViewState(activeDoc?.id);
  return (
    <DocumentHubServiceProvider value={documentHubService}>
      <div className={styles.documentArea} tabIndex={-1}>
        <DocumentsHeader />
        {activeDoc && (
          <DocumentsContainer
            document={activeDoc}
            contents={data}
            viewState={viewState}
            apiLoaded={api => {
              documentHubService.setDocumentApi(activeDoc.id, api);
            }}
          />
        )}
      </div>
    </DocumentHubServiceProvider>
  );
};
