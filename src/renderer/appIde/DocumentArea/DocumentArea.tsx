import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useRef, useState } from "react";
import { useAppServices } from "../services/AppServicesProvider";
import styles from "./DocumentArea.module.scss";
import { DocumentsContainer } from "./DocumentsContainer";
import { DocumentsHeader } from "./DocumentsHeader";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import { DocumentServiceProvider } from "../services/DocumentServiceProvider";
import { resetDocumentHubAction, setActiveDocumentHubAction } from "@common/state/actions";

type Props = {
  areaId?: number;
}

export const DocumentArea = ({ areaId = 0}: Props) => {
  const dispatch  = useDispatch();
  const { documentService, setDocumentHub } = useAppServices();
  const openDocs = useSelector(s => s.ideView?.openDocuments);
  const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const [activeDoc, setActiveDoc] = useState<DocumentInfo>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    dispatch(resetDocumentHubAction(areaId));

    return () => {
      mounted.current = false;
    }
  })

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
    <DocumentServiceProvider>
      <div
        className={styles.documentArea}
        tabIndex={-1}
        onFocus={() => {
          setDocumentHub(documentService);
          dispatch(setActiveDocumentHubAction(areaId));
          console.log("Setting document hub", areaId);
        }}
      >
        <DocumentsHeader />
        {activeDocIndex >= 0 && (
          <DocumentsContainer document={activeDoc} data={data} />
        )}
      </div>
    </DocumentServiceProvider>
  );
};
