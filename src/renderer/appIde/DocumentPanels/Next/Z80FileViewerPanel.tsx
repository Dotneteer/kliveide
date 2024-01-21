import styles from "./Z80FileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";

const Z80FileViewerPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".Z80 Viewer" />
      </div>
    </div>
  );
};

export const createZ80FileViewerPanel = ({ document, contents }: DocumentProps) => (
  <Z80FileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
