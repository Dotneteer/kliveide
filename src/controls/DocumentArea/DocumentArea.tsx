import { useIdeServices } from "@/ide/IdeServicesProvider";
import styles from "./DocumentArea.module.scss";
import { DocumentsHeader } from "./DocumentsHeader";

export const DocumentArea = () => {
    const ideService = useIdeServices();
    return <div className={styles.component}>
        <DocumentsHeader />
        <div className={styles.documentContainer}>
            DocumentContainer
        </div>
    </div>
}