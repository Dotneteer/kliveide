import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import DocumentTabBar from "./DocumentTabBar";

import { useEffect, useState } from "react";
import {
  documentService,
  DocumentsInfo,
  IDocumentPanel,
} from "./DocumentService";
import { CSSProperties } from "react";
import CommandIconButton from "../command/CommandIconButton";
import { useRef } from "react";

/**
 * Represents the statusbar of the emulator
 */
export default function IdeDocumentFrame() {
  const mounted = useRef(false);

  const [tabBarVisible, setTabBarVisible] = useState(true);
  const [activeDoc, setActiveDoc] = useState<IDocumentPanel | null>(
    documentService.getActiveDocument()
  );

  // --- Refresh the documents when any changes occur
  const refreshDocs = (info: DocumentsInfo) => {
    setTabBarVisible(info.docs.length !== 0);
    setActiveDoc(info.active);
  };

  useEffect(() => {
    // --- Mount
    if (!mounted.current) {
      mounted.current = true;
      documentService.documentsChanged.on(refreshDocs);
    }

    return () => {
      // --- Unmount
      documentService.documentsChanged.off(refreshDocs);
      mounted.current = false;
    };
  });

  return (
    <Root tabIndex={0}>
      {tabBarVisible && (
        <HeaderBar>
          <DocumentTabBar />
          <DocumentCommandBar />
        </HeaderBar>
      )}
      <PlaceHolder 
        // key={activeDoc?.id}
      >
        {activeDoc?.createContentElement()}
      </PlaceHolder>
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  fitToClient: false,
  background: "var(--shell-canvas-background-color)",
});

// --- Component helper tags
const HeaderBar = createSizedStyledPanel({
  height: 35,
  splitsVertical: false,
  fitToClient: false,
});

const PlaceHolder = createSizedStyledPanel({
  others: {
    background: "var(--shell-canvas-background-color)",
  },
});

/**
 * Represents the command bar of the document frame
 */
function DocumentCommandBar() {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    width: "auto",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "6px",
    paddingRight: "6px",
    background: "var(--commandbar-background-color)",
  };

  return (
    <div style={style}>
      <CommandIconButton
        iconName="close"
        title="Close All"
        clicked={() => {
          documentService.closeAll();
        }}
      />
    </div>
  );
}
