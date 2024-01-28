import styles from "./NplFileEditorPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";

const NplFileEditorPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".NPL Editor" />
      </div>
    </div>
  );
};

export const createNplFileEditorPanel = ({ document, contents }: DocumentProps) => (
  <NplFileEditorPanel document={document} contents={contents} apiLoaded={() => {}} />
);
