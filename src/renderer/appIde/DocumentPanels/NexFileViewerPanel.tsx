import styles from "./NexFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";

const NexFileViewerPanel = ({ document, contents }: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".NEX Viewer" />
      </div>
    </div>
  );
};

export const createNexFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <NexFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
