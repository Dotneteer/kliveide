import styles from "./Sl2FileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";

const Sl2FileViewerPanel = ({ document, contents }: DocumentProps) => {
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
