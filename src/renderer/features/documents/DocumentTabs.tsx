import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { CloseMode, DocumentTab } from "./DocumentTab";
import styles from "./DocumentsHeader.module.scss";
import { type DragEvent, useMemo, useState } from "react";

type TabDropPlacement = "before" | "after";

type DocumentTabsProps = {
  activeDocIndex: number;
  awaiting: boolean;
  dirtyStates?: boolean[];
  isProjectDebugging: boolean;
  openDocs: ProjectDocumentState[];
  onTabClicked: (id: string) => void;
  onTabCloseClicked: (mode: CloseMode, id: string) => void;
  onTabDisplayed: (idx: number, el: HTMLDivElement) => void;
  onTabDoubleClicked: (document: ProjectDocumentState) => void;
  onTabMoved: (sourceId: string, targetId: string, after: boolean) => void;
  tabsCount: number;
};

/**
 * Maps open document state to draggable tab items and reports tab reorder requests
 * without owning document hub state itself.
 */
export function DocumentTabs({
  activeDocIndex,
  awaiting,
  dirtyStates,
  isProjectDebugging,
  openDocs,
  onTabClicked,
  onTabCloseClicked,
  onTabDisplayed,
  onTabDoubleClicked,
  onTabMoved,
  tabsCount
}: DocumentTabsProps) {
  const [draggedTabId, setDraggedTabId] = useState<string>();
  const [dragOver, setDragOver] = useState<{
    id: string;
    placement: TabDropPlacement;
  }>();
  const duplicateNames = useMemo(() => getDuplicateDocumentNames(openDocs), [openDocs]);

  const getDropPlacement = (event: DragEvent<HTMLDivElement>): TabDropPlacement => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX > rect.left + rect.width / 2 ? "after" : "before";
  };

  return (
    <div className={styles.tabWrapper}>
      {openDocs.map((document, idx) => {
        const docName = getDocumentTabName(document, duplicateNames);
        return (
          <DocumentTab
            key={document.id}
            name={docName}
            path={document.path}
            isActive={idx === activeDocIndex}
            isTemporary={document.isTemporary}
            isReadOnly={document.isReadOnly}
            isLocked={isProjectDebugging && document.isLocked}
            awaiting={awaiting}
            hasChanges={dirtyStates?.[idx]}
            dragOverPlacement={dragOver?.id === document.id ? dragOver.placement : undefined}
            tabsCount={tabsCount}
            iconName={document.iconName}
            iconFill={document.iconFill}
            tabDisplayed={(el) => onTabDisplayed(idx, el)}
            tabClicked={() => onTabClicked(document.id)}
            tabDoubleClicked={() => onTabDoubleClicked(document)}
            tabCloseClicked={(mode: CloseMode) => onTabCloseClicked(mode, document.id)}
            tabDragEnd={() => {
              setDraggedTabId(undefined);
              setDragOver(undefined);
            }}
            tabDragLeave={() => {
              setDragOver((current) => current?.id === document.id ? undefined : current);
            }}
            tabDragOver={(event) => {
              const sourceId = draggedTabId ?? event.dataTransfer.getData("text/plain");
              if (!sourceId || sourceId === document.id) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOver({
                id: document.id,
                placement: getDropPlacement(event)
              });
            }}
            tabDragStart={(event) => {
              setDraggedTabId(document.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", document.id);
            }}
            tabDrop={(event) => {
              const sourceId = draggedTabId ?? event.dataTransfer.getData("text/plain");
              if (!sourceId || sourceId === document.id) return;
              event.preventDefault();
              const placement = getDropPlacement(event);
              setDraggedTabId(undefined);
              setDragOver(undefined);
              onTabMoved(sourceId, document.id, placement === "after");
            }}
          />
        );
      })}
    </div>
  );
}

function getDuplicateDocumentNames(openDocs: ProjectDocumentState[]): Set<string> {
  const nameCounts = new Map<string, number>();
  openDocs.forEach((document) => {
    nameCounts.set(document.name, (nameCounts.get(document.name) ?? 0) + 1);
  });
  return new Set(
    [...nameCounts]
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
  );
}

function getDocumentTabName(
  document: ProjectDocumentState,
  duplicateNames: Set<string>
): string {
  return duplicateNames.has(document.name) && document.path
    ? document.path
    : document.name;
}
