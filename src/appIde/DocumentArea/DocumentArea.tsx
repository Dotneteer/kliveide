import { useSelector } from "@/core/RendererProvider";
import { useEffect, useState } from "react";
import { DocumentState } from "../abstractions";
import styles from "./DocumentArea.module.scss";
import { DocumentsContainer } from "./DocumentsContainer";
import { DocumentsHeader } from "./DocumentsHeader";

export const DocumentArea = () => {
  const openDocs = useSelector(s => s.ideView?.openDocuments);
  const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const [activeDoc, setActiveDoc] = useState<DocumentState>(null);

  // --- Manage saving and restoring state when the active index changes
  useEffect(() => {
    const current = openDocs?.[activeDocIndex];
    if (current) {
      setActiveDoc(current);
    }
  }, [openDocs, activeDocIndex]);

  return (
    <div className={styles.component}>
      <DocumentsHeader />
      {activeDocIndex >= 0 && <DocumentsContainer document={activeDoc} />}
    </div>
  );
};
