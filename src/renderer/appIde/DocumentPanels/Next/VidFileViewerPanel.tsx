import styles from "./VidFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";

const VidFileViewerPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".VID Viewer" />
      </div>
    </div>
  );
};

export const createVidFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <VidFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
