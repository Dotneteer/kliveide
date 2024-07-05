import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import styles from "./UnknownFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";

const UnknownFileViewerPanel = ({}: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <Label text="This file type has no associated viewer" />
    </div>
  );
};

export const createUnknownFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <UnknownFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
