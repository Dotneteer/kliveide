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
    const current = documentHubService?.getActiveDocument();
    if (current) {
      setActiveDoc(current);
    }
  }, [hubVersion, projectViewStateVersion]);

  const data = activeDoc?.id
    ? documentHubService.getDocumentData(activeDoc?.id)
    : null;
  return (
    <DocumentHubServiceProvider value={documentHubService}>
      <div className={styles.documentArea} tabIndex={-1}>
        <DocumentsHeader />
        {activeDoc && (
          <DocumentsContainer
            document={activeDoc}
            data={data}
            apiLoaded={api => {
              documentHubService.setDocumentApi(activeDoc.id, api);
            }}
          />
        )}
      </div>
    </DocumentHubServiceProvider>
  );
};
