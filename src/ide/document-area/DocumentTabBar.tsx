import * as React from "react";
import { useEffect, useState } from "react";

import {
  getDocumentService,
  getProjectService,
  getStore,
} from "@core/service-registry";
import ScrollablePanel from "@components/ScrollablePanel";
import { ProjectState } from "@state/AppState";
import { DocumentsInfo, IDocumentPanel } from "@abstractions/document-service";
import { FileChange } from "@abstractions/project-service";
import { getEditorService } from "../editor/editorService";
import DocumentTab from "./DocumentTab";

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
  const fileDeleted = async (name: string) => {
    for (const doc of currentDocs) {
      if (doc.id === name) {
        await documentService.unregisterDocument(doc);
        setCurrentDocs(documentService.getDocuments());
        break;
      }
    }
  };

  // --- Remove this tab if the document's folder has been deleted
  const folderDeleted = async (name: string) => {
    let changed = false;
    for (const doc of currentDocs.slice(0)) {
      if (doc.id.startsWith(`${name}/`)) {
        await documentService.unregisterDocument(doc);
        changed = true;
      }
    }
    if (changed) {
      setCurrentDocs(documentService.getDocuments());
    }
  };

  // --- Close open documents whenever the project is closed
  const projectChanged = async (projectState: ProjectState) => {
    if (!projectState.isLoading && !projectState.path) {
      await documentService.closeAll();
    }
  };

  const _refreshDocs = (info: DocumentsInfo) => refreshDocs(info);
  const _folderDeleted = async (name: string) => await folderDeleted(name);
  const _folderRenamed = (arg: FileChange) => folderRenamed(arg);
  const _fileDeleted = async (name: string) => await fileDeleted(name);
  const _fileRenamed = (arg: FileChange) => fileRenamed(arg);
  const _projectChanged = async (state: ProjectState) => await projectChanged(state);

  useEffect(() => {
    // --- Mount
    setCurrentDocs(documentService.getDocuments());
    setActiveDoc(documentService.getActiveDocument());
    const projectService = getProjectService();
    documentService.documentsChanged.on(_refreshDocs);
    projectService.folderDeleted.on(_folderDeleted);
    projectService.fileRenamed.on(_fileRenamed);
    projectService.folderRenamed.on(_folderRenamed);
    projectService.fileDeleted.on(_fileDeleted);
    getStore().projectChanged.on(_projectChanged);

    return () => {
      // --- Unmount
      const projectService = getProjectService();
      documentService.documentsChanged.off(_refreshDocs);
      projectService.fileRenamed.off(_fileRenamed);
      projectService.folderRenamed.off(_folderRenamed);
      projectService.fileDeleted.off(_fileDeleted);
      projectService.folderDeleted.off(_folderDeleted);
      getStore().projectChanged.off(_projectChanged);
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
        descriptor={d}
        isLast={index >= currentDocs.length - 1}
        clicked={async () => {
          if (activeDoc !== d) {
            await documentService.setActiveDocument(d);
          }
          d.initialFocus = true;
        }}
        closed={async () => {
          getEditorService().clearState(d.id);
          await documentService.unregisterDocument(d);
        }}
      />
    );
  });

  return (
    <>
      {currentDocs.length > 0 && (
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
      )}
    </>
  );
}
