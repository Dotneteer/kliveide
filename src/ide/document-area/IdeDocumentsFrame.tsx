import * as React from "react";
import { useRef, useEffect, useState, CSSProperties } from "react";

import { getDocumentService, getState } from "@core/service-registry";
import { DocumentsInfo, IDocumentPanel } from "@abstractions/document-service";
import { IKliveCommand } from "@abstractions/command-definitions";
import { commandStatusChanged } from "@abstractions/command-registry";
import { CommandIconButton } from "../context-menu/CommandIconButton";
import { DocumentTabBar } from "./DocumentTabBar";

/**
 * Represents the statusbar of the emulator
 */
export const IdeDocumentFrame: React.VFC = () => {
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

  return (
    <div tabIndex={0} style={rootStyle}>
      {tabBarVisible && (
        <>
          <div style={headerStyle}>
            <DocumentTabBar />
            <DocumentCommandBar />
          </div>
          <div style={placeholderStyle} key={activeDoc?.id}>
            {activeDoc?.createContentElement()}
          </div>
        </>
      )}
    </div>
  );
};

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
  overflow: "hidden",
};

/**
 * Represents the command bar of the document frame
 */
function DocumentCommandBar() {
  const [buildRootCommands, setBuildRootCommands] = useState<IKliveCommand[]>(
    []
  );
  const refreshCommands = async () => {
    const activeDoc = getDocumentService().getActiveDocument();
    if (activeDoc) {
      const filename = activeDoc.projectNode.fullPath.substr(
        getState().project.path.length
      );

      // --- Let's check if we can allow code-runner commands in the document frame
      if (getState().builder.roots.includes(filename)) {
        // --- What language does the current document support?
        const language = await getDocumentService().getCodeEditorLanguage(
          activeDoc.id
        );
        const languageInfo = getDocumentService().getCustomLanguage(language);
        if (languageInfo.supportsKlive) {
          // --- Super, this compiler can work with Klive
          setBuildRootCommands([
            { commandId: "klive.compileCode" },
            { commandId: "klive.injectCodeIntoVm" },
            { commandId: "klive.injectAndStartVm" },
            { commandId: "klive.injectAndDebugVm" },
          ]);
        }
      } else {
        // --- No build commands are allowed
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
