import styles from "./Sl2FileViewerPanel.module.scss";
import { Label } from "@renderer/controls/layout/Label";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const Sl2FileViewerPanel = ({}: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Label text=".SL2 Viewer" />
      </div>
    </div>
  );
};

export const createSl2FileViewerPanel = ({ document, contents }: DocumentProps) => (
  <Sl2FileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
