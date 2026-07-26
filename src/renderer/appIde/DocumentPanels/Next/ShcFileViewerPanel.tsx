import styles from "./ShcFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/layout/Label";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const ShcFileViewerPanel = ({}: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".SHC Viewer" />
      </div>
    </div>
  );
};

export const createShcFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ShcFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
