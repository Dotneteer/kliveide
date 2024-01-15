import styles from "./ScrFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";

const ScrFileViewerPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".SCR Viewer" />
      </div>
    </div>
  );
};

export const createScrFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ScrFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
