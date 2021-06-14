import * as React from "react";

import { documentService } from "./DocumentService";
import DocumentTab from "./DocumentTab";

/**
 * Represents the statusbar of the emulator
 */
export default function DocumentTabBar() {
  let documentTabs: React.ReactNode[] = [];
  const docs = documentService.getDocuments();
  docs.forEach((d) =>
    documentTabs.push(<DocumentTab title={d.title} active={d.active} />)
  );

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    width: "100%",
    height: "100%",
  };
  return <div style={style}>{documentTabs}</div>;
}
