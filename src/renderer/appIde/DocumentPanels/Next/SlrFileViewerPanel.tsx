import styles from "./SlrFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";

const SlrFileViewerPanel = ({}: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".SLR Viewer" />
      </div>
    </div>
  );
};

export const createSlrFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <SlrFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
