import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import styles from "./XmlUiPanel.module.scss";
import { Label } from "@renderer/controls/Labels";

const XmlUiPanel = ({}: DocumentProps) => {
  return (
    <div className={styles.panel}>
      <Label text="This is an XMLUI Panel" />
    </div>
  );
};

export const createXmluiPanel = ({ document, contents }: DocumentProps) => (
  <XmlUiPanel document={document} contents={contents} apiLoaded={() => {}} />
);
