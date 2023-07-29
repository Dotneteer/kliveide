import { useSelector } from "@/renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { useAppServices } from "../services/AppServicesProvider";
import styles from "./DocumentArea.module.scss";
import { DocumentsContainer } from "./DocumentsContainer";
import { DocumentsHeader } from "./DocumentsHeader";
import { DocumentInfo } from "@abstractions/DocumentInfo";

export const DocumentArea = () => {
  const { documentService } = useAppServices();
  const openDocs = useSelector(s => s.ideView?.openDocuments);
  const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const [activeDoc, setActiveDoc] = useState<DocumentInfo>(null);

  // --- Manage saving and restoring state when the active index changes
  useEffect(() => {
    const current = openDocs?.[activeDocIndex];
    if (current) {
      setActiveDoc(current);
    }
  }, [openDocs, activeDocIndex]);

  const data = activeDoc?.id ? documentService.getDocumentData(activeDoc?.id) : null;
  return  (
    <div className={styles.documentArea}>
      <DocumentsHeader />
      {activeDocIndex >= 0 && (
        <DocumentsContainer
          document={activeDoc}
          data={data}
        />
      )}
    </div>
  );
};
