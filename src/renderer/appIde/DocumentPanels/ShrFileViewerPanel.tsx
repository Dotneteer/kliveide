import styles from "./ShrFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";

const ShrFileViewerPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".SHR Viewer" />
      </div>
    </div>
  );
};

export const createShrFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ShrFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
