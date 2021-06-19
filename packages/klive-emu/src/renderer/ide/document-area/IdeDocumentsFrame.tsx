import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import DocumentTabBar from "./DocumentTabBar";
import CommandBar from "./CommandBar";
import { useEffect, useState } from "react";
import {
  documentService,
  DocumentsInfo,
  IDocumentPanel,
} from "./DocumentService";

/**
 * Represents the statusbar of the emulator
 */
export default function IdeDocumentFrame() {
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const [activeDoc, setActiveDoc] = useState<IDocumentPanel | null>(null);

  // --- Refresh the documents when any changes occur
  const refreshDocs = (info: DocumentsInfo) => {
    setTabBarVisible(info.docs.length !== 0);
    setActiveDoc(info.active);
  };

  useEffect(() => {
    // --- Mount
    documentService.documentsChanged.on(refreshDocs);

    return () => {
      // --- Unmount
      documentService.documentsChanged.off(refreshDocs);
    };
  });

  return (
    <Root>
      {tabBarVisible && (
        <HeaderBar>
          <DocumentTabBar />
          <CommandBar />
        </HeaderBar>
      )}
      <PlaceHolder>{activeDoc?.createContentElement()}</PlaceHolder>
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  background: "var(--shell-canvas-background-color)",
});

// --- Component helper tags
const HeaderBar = createSizedStyledPanel({
  height: 35,
  splitsVertical: false,
  fitToClient: true,
});

const PlaceHolder = createSizedStyledPanel({
  others: {
    background: "#404040",
  },
});
