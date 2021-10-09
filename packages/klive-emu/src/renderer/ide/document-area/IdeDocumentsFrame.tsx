import * as React from "react";

import { getDocumentService, getState } from "@core/service-registry";

import DocumentTabBar from "./DocumentTabBar";
import ReactResizeDetector from "react-resize-detector";

import { useEffect, useState } from "react";
import { CSSProperties } from "react";
import CommandIconButton from "../context-menu/CommandIconButton";
import { useRef } from "react";
import { useLayoutEffect } from "react";
import { DocumentsInfo, IDocumentPanel } from "@abstractions/document-service";
import { IKliveCommand } from "@core/abstractions/command-def";
import { commandStatusChanged } from "@abstractions/command-registry";

// --- Document Frame IDs
const DOC_CONTAINER_ID = "ideDocumentContainer";
const DOC_HEADER_ID = "ideDocumentFrameHeader";
const DOC_PLACEHOLDER_ID = "ideDocumentPlaceHolder";

/**
 * Represents the statusbar of the emulator
 */
export default function IdeDocumentFrame() {
  const mounted = useRef(false);
  const documentService = getDocumentService();

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

  useLayoutEffect(() => {
    if (mounted.current) {
      onResize();
    }
  });

  return (
    <div tabIndex={0} id={DOC_CONTAINER_ID} style={rootStyle}>
      {tabBarVisible && (
        <>
          <div id={DOC_HEADER_ID} style={headerStyle}>
            <DocumentTabBar />
            <DocumentCommandBar />
          </div>
          <div
            id={DOC_PLACEHOLDER_ID}
            style={placeholderStyle}
            key={activeDoc?.id}
          >
            {activeDoc?.createContentElement()}
          </div>
        </>
      )}
      <ReactResizeDetector
        handleWidth
        handleHeight
        onResize={() => onResize()}
      />
    </div>
  );

  /**
   * Resize the document placeholder
   */
  function onResize(): void {
    const containerDiv = document.getElementById(DOC_CONTAINER_ID);
    const headerDiv = document.getElementById(DOC_HEADER_ID);
    const placeHolderDiv = document.getElementById(DOC_PLACEHOLDER_ID);
    if (containerDiv && headerDiv && placeHolderDiv) {
      const placeHolderHeight =
        containerDiv.offsetHeight - headerDiv.offsetHeight;
      placeHolderDiv.style.height = `${placeHolderHeight}px`;
    }
  }
}

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  backgroundColor: "var(--shell-canvas-background-color)",
  outline: "none",
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

/**
 * Represents the command bar of the document frame
 */
function DocumentCommandBar() {
  const [buildRootCommands, setBuildRootCommands] = useState<IKliveCommand[]>(
    []
  );
  const refreshCommands = () => {
    const activeDoc = getDocumentService().getActiveDocument();
    if (activeDoc) {
      const filename = activeDoc.projectNode.fullPath.substr(
        getState().project.path.length
      );
      if (getState().builder.roots.includes(filename)) {
        setBuildRootCommands([
          { commandId: "klive.compileCode" },
          { commandId: "klive.injectCodeIntoVm" },
          { commandId: "klive.injectAndStartVm" },
          { commandId: "klive.injectAndDebugVm" },
        ]);
      } else {
        setBuildRootCommands([]);
      }
    }
  };

  useEffect(() => {
    const documentService = getDocumentService();
    documentService.documentsChanged.on(refreshCommands);
    commandStatusChanged.on(refreshCommands);

    return () => {
      documentService.documentsChanged.off(refreshCommands);
      commandStatusChanged.off(refreshCommands);
    };
  });

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

  const commandIcons = buildRootCommands.map((cmd, index) => (
    <CommandIconButton
      key={index}
      commandId={cmd.commandId}
      setContext={() => ({
        resource: getDocumentService().getActiveDocument().id,
        resourceActive: true,
      })}
    ></CommandIconButton>
  ));

  return <div style={style}>{commandIcons}</div>;
}
