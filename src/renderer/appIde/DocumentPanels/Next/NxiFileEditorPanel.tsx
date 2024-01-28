import styles from "./NxiFileEditorPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";

const NxiFileEditorPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".NXI Editor" />
      </div>
    </div>
  );
};

export const createNxiFileEditorPanel = ({ document, contents }: DocumentProps) => (
  <NxiFileEditorPanel document={document} contents={contents} apiLoaded={() => {}} />
);
