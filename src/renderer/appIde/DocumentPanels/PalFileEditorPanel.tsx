import styles from "./PalFileEditorPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";

const PalFileEditorPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".PAL Editor" />
      </div>
    </div>
  );
};

export const createPalFileEditorPanel = ({ document, contents }: DocumentProps) => (
  <PalFileEditorPanel document={document} contents={contents} apiLoaded={() => {}} />
);
