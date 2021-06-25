import * as React from "react";
import { useEffect } from "react";
import { useState } from "react";
import ScrollablePanel from "../../common/ScrollablePanel";

import {
  documentService,
  DocumentsInfo,
  IDocumentPanel,
} from "./DocumentService";
import DocumentTab from "./DocumentTab";

/**
 * Represents the statusbar of the emulator
 */
export default function DocumentTabBar() {
  // --- Component state
  const [activeDoc, setActiveDoc] = useState<IDocumentPanel | null>(null);
  const [currentDocs, setCurrentDocs] = useState<IDocumentPanel[]>([]);

  // --- Refresh the documents when any changes occur
  const refreshDocs = (info: DocumentsInfo) => {
    setCurrentDocs(info.docs);
    setActiveDoc(info.active);
  };

  useEffect(() => {
    // --- Mount
    setCurrentDocs(documentService.getDocuments());
    setActiveDoc(documentService.getActiveDocument());
    documentService.documentsChanged.on(refreshDocs);

    return () => {
      // --- Unmount
      documentService.documentsChanged.off(refreshDocs);
    };
  });

  // --- Create the list of visible documents
  let documentTabs: React.ReactNode[] = [];
  currentDocs.forEach((d, index) => {
    documentTabs.push(
      <DocumentTab
        title={d.title}
        active={d === activeDoc}
        key={index}
        index={index}
        document={d}
        isLast={index >= currentDocs.length - 1}
        clicked={() => {
          if (activeDoc !== d) {
            documentService.setActiveDocument(d);
          }
        }}
        closed={() => {
          documentService.unregisterDocument(d);
        }}
      />
    );
  });

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    width: "100%",
    height: "100%",
    background: "var(--commandbar-background-color)",
    overflowX: "hidden",
  };

  return (
    <ScrollablePanel>
      {documentTabs}
    </ScrollablePanel>
  );
}
