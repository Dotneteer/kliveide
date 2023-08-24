import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useRef, useState } from "react";
import { useAppServices } from "../services/AppServicesProvider";
import { DocumentsContainer } from "./DocumentsContainer";
import { DocumentsHeader } from "./DocumentsHeader";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import styles from "./DocumentArea.module.scss";
import { DocumentServiceProvider } from "../services/DocumentServiceProvider";

export const DocumentArea = () => {
  const { documentHubService } = useAppServices();
  const documentService = documentHubService.getActiveDocumentService();
  const openDocs = useSelector(s => s.ideView?.openDocuments);
  const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const [activeDoc, setActiveDoc] = useState<DocumentInfo>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  });

  // --- Manage saving and restoring state when the active index changes
  useEffect(() => {
    const current = openDocs?.[activeDocIndex];
    if (current) {
      setActiveDoc(current);
    }
  }, [openDocs, activeDocIndex]);

  const data = activeDoc?.id
    ? documentService.getDocumentData(activeDoc?.id)
    : null;
  return (
    <DocumentServiceProvider value={documentService}>
      <div className={styles.documentArea} tabIndex={-1}>
        <DocumentsHeader />
        {activeDocIndex >= 0 && (
          <DocumentsContainer
            document={activeDoc}
            data={data}
            apiLoaded={api => {
              documentService.setDocumentApi(activeDoc.id, api);
            }}
          />
        )}
      </div>
    </DocumentServiceProvider>
  );
};
