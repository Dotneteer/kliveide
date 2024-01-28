import styles from "./SnaFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";

const SnaFileViewerPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".SNA Viewer" />
      </div>
    </div>
  );
};

export const createSnaFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <SnaFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
