import * as React from "react";
import { useEffect } from "react";
import { useState } from "react";
import ScrollablePanel from "../../common-ui/ScrollablePanel";
import { editorService } from "../editor/editorService";
import { FileChange, projectServices } from "../explorer-tools/ProjectServices";
import { ideStore } from "../ideStore";
import { IDocumentPanel } from "./DocumentFactory";
import { ProjectState } from "../../../shared/state/AppState";

import { documentService, DocumentsInfo } from "./DocumentService";
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

  // --- Rename document tab is the document file has been renamed
  const fileRenamed = (args: FileChange) => {
    for (const doc of currentDocs) {
      if (doc.id === args.oldName) {
        doc.id = args.newName;
        const segments = doc.id.split("/");
        doc.title = segments[segments.length - 1];
        documentService.fireChanges();
        break;
      }
    }
  };

  // --- Change the path of documents if their folder has been renamed
  const folderRenamed = (args: FileChange) => {
    let changed = false;
    for (const doc of currentDocs) {
      if (doc.id.startsWith(`${args.oldName}/`)) {
        doc.id = `${args.newName}${doc.id.substr(args.oldName.length)}`;
        const segments = doc.id.split("/");
        doc.title = segments[segments.length - 1];
        changed = true;
      }
    }
    if (changed) {
      documentService.fireChanges();
    }
  };

  // --- Remove this tab if the document file has been deleted
  const fileDeleted = (name: string) => {
    for (const doc of currentDocs) {
      if (doc.id === name) {
        documentService.unregisterDocument(doc);
        setCurrentDocs(documentService.getDocuments());
        break;
      }
    }
  };

  // --- Remove this tab if the document's folder has been deleted
  const folderDeleted = (name: string) => {
    let changed = false;
    for (const doc of currentDocs.slice(0)) {
      if (doc.id.startsWith(`${name}/`)) {
        documentService.unregisterDocument(doc);
        changed = true;
      }
    }
    if (changed) {
      setCurrentDocs(documentService.getDocuments());
    }
  };

  // --- Close open documents whenever the project is closed
  const projectChanged = (projectState: ProjectState) => {
    if (!projectState.isLoading && !projectState.path) {
      currentDocs
        .slice(0)
        .forEach((doc) => documentService.unregisterDocument(doc));
      setCurrentDocs(documentService.getDocuments());
    }
  };

  useEffect(() => {
    // --- Mount
    setCurrentDocs(documentService.getDocuments());
    setActiveDoc(documentService.getActiveDocument());
    documentService.documentsChanged.on(refreshDocs);
    projectServices.folderDeleted.on(folderDeleted);
    projectServices.fileRenamed.on(fileRenamed);
    projectServices.folderRenamed.on(folderRenamed);
    projectServices.fileDeleted.on(fileDeleted);
    ideStore.projectChanged.on(projectChanged);

    return () => {
      // --- Unmount
      documentService.documentsChanged.off(refreshDocs);
      projectServices.fileRenamed.off(fileRenamed);
      projectServices.folderRenamed.off(folderRenamed);
      projectServices.fileDeleted.off(fileDeleted);
      projectServices.folderDeleted.off(folderDeleted);
      ideStore.projectChanged.off(projectChanged);
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
          editorService.clearState(d.id);
          documentService.unregisterDocument(d);
        }}
      />
    );
  });

  return (
    <ScrollablePanel background="var(--commandbar-background-color)">
      <div
        style={{
          display: "flex",
          height: "100%",
        }}
      >
        {documentTabs}
      </div>
    </ScrollablePanel>
  );
}
