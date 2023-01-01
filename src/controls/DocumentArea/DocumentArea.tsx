import { useSelector } from "@/core/StoreProvider";
import styles from "./DocumentArea.module.scss";
import { DocumentsContainer } from "./DocumentsContainer";
import { DocumentsHeader } from "./DocumentsHeader";

export const DocumentArea = () => {
    const openDocs = useSelector(s => s.ideView?.openDocuments);
    const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);

    return <div className={styles.component}>
        <DocumentsHeader />
        <DocumentsContainer document={openDocs[activeDocIndex]}/>
    </div>
}