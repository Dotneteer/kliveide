import { DocumentState } from "@/appIde/abstractions";
import { documentPanelRegistry } from "@/registry";
import { createElement } from "react";
import styles from "./DocumentsContainer.module.scss";

type Props = {
  document?: DocumentState;
};

export const DocumentsContainer = ({ document }: Props) => {
  // --- Get the document's renderer from the registry
  const docRenderer = documentPanelRegistry.find(
    dp => dp.id === document?.type
  );

  if (docRenderer) {
    document.iconName = docRenderer.icon;
    document.iconFill = docRenderer.iconFill
  }

  return document ? (
    docRenderer ? (
      createElement(docRenderer.renderer, document)
    ) : (
      <div className={styles.component}>Cannot find renderer</div>
    )
  ) : null;
};
