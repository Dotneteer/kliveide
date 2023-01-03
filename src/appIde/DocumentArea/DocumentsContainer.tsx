import { DocumentState } from "@/appIde/abstractions";
import styles from "./DocumentsContainer.module.scss";

type Props = {
    document?: DocumentState
}

export const DocumentsContainer = ({
    document
}: Props) => {
    return document
        ? <div className={styles.component}>
            {document.name}
        </div>
        : null;
}