import { useSelector } from "@/core/RendererProvider";
import styles from "./DocumentsHeader.module.scss";
import { DocumentTab } from "./DocumentTab";

export const DocumentsHeader = () => {
    const openDocs = useSelector(s => s.ideView?.openDocuments);
    const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
    
    return <div className={styles.component}>
        {(openDocs ?? []).map((d, idx) => 
            <DocumentTab 
                key={d.id} 
                index={idx}
                id={d.id} 
                name={d.name} 
                type={d.type}   
                isActive={idx === activeDocIndex}
                isTemporary={d.isTemporary}
                isReadOnly={d.isReadOnly} />)
        }
        <div className={styles.closingTab} />
    </div>
}