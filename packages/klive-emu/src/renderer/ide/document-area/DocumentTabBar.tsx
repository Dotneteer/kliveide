import * as React from "react";
import { useEffect } from "react";
import { useState } from "react";
import ScrollablePanel from "../../common-ui/ScrollablePanel";
import { getEditorService } from "../../../abstractions/service-helpers";
import { FileChange } from "../explorer-tools/ProjectService";
import { ProjectState } from "../../../shared/state/AppState";

import { getDocumentService } from "../../../abstractions/service-helpers";
import DocumentTab from "./DocumentTab";
import { getProjectService, getStore } from "../../../abstractions/service-helpers";
import { DocumentsInfo, IDocumentPanel } from "../../../shared/services/IDocumentService";

/**
 * Represents the statusbar of the emulator
 */
export default function DocumentTabBar() {
  // --- Component state
  const [activeDoc, setActiveDoc] = useState<IDocumentPanel | null>(null);
  const [currentDocs, setCurrentDocs] = useState<IDocumentPanel[]>([]);

  // --- Refresh the documents when any changes occur
  const documentService = getDocumentService();
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
    const projectService = getProjectService();
    projectService.folderDeleted.on(folderDeleted);
    projectService.fileRenamed.on(fileRenamed);
    projectService.folderRenamed.on(folderRenamed);
    projectService.fileDeleted.on(fileDeleted);
    getStore().projectChanged.on(projectChanged);

    return () => {
      // --- Unmount
      const projectService = getProjectService();
      documentService.documentsChanged.off(refreshDocs);
      projectService.fileRenamed.off(fileRenamed);
      projectService.folderRenamed.off(folderRenamed);
      projectService.fileDeleted.off(fileDeleted);
      projectService.folderDeleted.off(folderDeleted);
      getStore().projectChanged.off(projectChanged);
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
          d.initialFocus = true;
        }}
        closed={() => {
          getEditorService().clearState(d.id);
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
