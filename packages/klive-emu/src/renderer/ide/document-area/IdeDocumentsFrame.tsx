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

// --- Document Frame IDs
const DOC_HEADER_ID = "ideDocumentFrameHeader";
const DOC_PLACEHOLDER_ID = "ideDocumentPlaceHolder";

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
      setTabBarVisible(documentService.getDocuments().length !== 0);
      setActiveDoc(documentService.getActiveDocument());
      documentService.documentsChanged.on(refreshDocs);
    }

    return () => {
      // --- Unmount
      documentService.documentsChanged.off(refreshDocs);
      mounted.current = false;
    };
  });

  return (
    <div tabIndex={0} style={rootStyle}>
      {tabBarVisible && (
        <div id={DOC_HEADER_ID} style={headerStyle}>
          <DocumentTabBar />
          <DocumentCommandBar />
        </div>
      )}
      <div style={placeholderStyle} key={activeDoc?.id}>
        {activeDoc?.createContentElement()}
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  backgroundColor: "var(--shell-canvas-background-color)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexGrow: 0,
  flexShrink: 0,
  width: "100%",
  height: 35,
};

const placeholderStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  backgroundColor: "var(--shell-canvas-background-color)",
};

// --- Component helper tags
const HeaderBar = createSizedStyledPanel({
  height: 35,
  splitsVertical: false,
  fitToClient: false,
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
