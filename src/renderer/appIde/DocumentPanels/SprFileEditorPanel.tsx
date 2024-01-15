import styles from "./SprFileEditorPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";

const SprFileEditorPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".SPR Editor" />
      </div>
    </div>
  );
};

export const createSprFileEditorPanel = ({ document, contents }: DocumentProps) => (
  <SprFileEditorPanel document={document} contents={contents} apiLoaded={() => {}} />
);
