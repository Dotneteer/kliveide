import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { CloseMode, DocumentTab } from "./DocumentTab";
import styles from "./DocumentsHeader.module.scss";
import { type DragEvent, useMemo, useState } from "react";
import { type DocumentAreaId } from "./documentAreaLayout";
import classnames from "classnames";

type TabDropPlacement = "before" | "after";

export const DOCUMENT_TAB_DRAG_MIME = "application/x-klive-document-tab";

export type DocumentTabDragData = {
  areaId?: DocumentAreaId;
  documentId: string;
};

type DocumentTabsProps = {
  activeDocIndex: number;
  areaId?: DocumentAreaId;
  awaiting: boolean;
  dirtyStates?: boolean[];
  isInActiveArea?: boolean;
  isProjectDebugging: boolean;
  openDocs: ProjectDocumentState[];
  onTabClicked: (id: string) => void;
  onTabCloseClicked: (mode: CloseMode, id: string) => void;
  onTabDisplayed: (idx: number, el: HTMLDivElement) => void;
  onTabDoubleClicked: (document: ProjectDocumentState) => void;
  onTabMoveLeft?: (documentId: string) => void;
  onTabMoveRight?: (documentId: string) => void;
  onTabMoveToNextArea?: (documentId: string) => void;
  onTabMoveToPreviousArea?: (documentId: string) => void;
  onSplitRight?: () => void;
  onSplitDown?: () => void;
  onTabMoved: (
    sourceId: string,
    targetId: string,
    after: boolean,
    sourceAreaId?: DocumentAreaId
  ) => void;
  tabsCount: number;
};

/**
 * Maps open document state to draggable tab items and reports tab reorder requests
 * without owning document hub state itself.
 */
export function DocumentTabs({
  activeDocIndex,
  areaId,
  awaiting,
  dirtyStates,
  isInActiveArea = true,
  isProjectDebugging,
  openDocs,
  onTabClicked,
  onTabCloseClicked,
  onTabDisplayed,
  onTabDoubleClicked,
  onTabMoveLeft,
  onTabMoveRight,
  onTabMoveToNextArea,
  onTabMoveToPreviousArea,
  onSplitRight,
  onSplitDown,
  onTabMoved,
  tabsCount
}: DocumentTabsProps) {
  const [draggedTabId, setDraggedTabId] = useState<string>();
  const [isAppendingAfterLastTab, setIsAppendingAfterLastTab] = useState(false);
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
    <div
      className={classnames(styles.tabWrapper, {
        [styles.dragAppend]: isAppendingAfterLastTab
      })}
      onDragOver={(event) => {
        if (event.defaultPrevented) return;
        if (!hasDocumentTabDragData(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(undefined);
        setIsAppendingAfterLastTab(true);
      }}
      onDragLeave={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ) {
          return;
        }
        setDragOver(undefined);
        setIsAppendingAfterLastTab(false);
      }}
      onDrop={(event) => {
        if (event.defaultPrevented) return;
        const dragData = getDocumentTabDragData(event);
        const targetDocument = openDocs[openDocs.length - 1];
        const sourceAreaId = dragData?.areaId === areaId ? undefined : dragData?.areaId;
        if (
          !dragData?.documentId ||
          !targetDocument ||
          (dragData.documentId === targetDocument.id && !sourceAreaId)
        ) {
          return;
        }
        event.preventDefault();
        setDraggedTabId(undefined);
        setDragOver(undefined);
        setIsAppendingAfterLastTab(false);
        if (sourceAreaId) {
          onTabMoved(dragData.documentId, targetDocument.id, true, sourceAreaId);
        } else {
          onTabMoved(dragData.documentId, targetDocument.id, true);
        }
      }}
    >
      {openDocs.map((document, idx) => {
        const docName = getDocumentTabName(document, duplicateNames);
        return (
          <DocumentTab
            key={document.id}
            name={docName}
            path={document.path}
            isActive={idx === activeDocIndex}
            isInActiveArea={isInActiveArea}
            isTemporary={document.isTemporary}
            isReadOnly={document.isReadOnly}
            isLocked={isProjectDebugging && document.isLocked}
            awaiting={awaiting}
            hasChanges={dirtyStates?.[idx]}
            dragOverPlacement={dragOver?.id === document.id ? dragOver.placement : undefined}
            tabsCount={tabsCount}
            canMoveLeft={idx > 0}
            canMoveRight={idx < openDocs.length - 1}
            canMoveToNextArea={!!onTabMoveToNextArea}
            canMoveToPreviousArea={!!onTabMoveToPreviousArea}
            iconName={document.iconName}
            iconFill={document.iconFill}
            tabDisplayed={(el) => onTabDisplayed(idx, el)}
            tabClicked={() => onTabClicked(document.id)}
            tabDoubleClicked={() => onTabDoubleClicked(document)}
            tabCloseClicked={(mode: CloseMode) => onTabCloseClicked(mode, document.id)}
            tabMoveLeft={() => onTabMoveLeft?.(document.id)}
            tabMoveRight={() => onTabMoveRight?.(document.id)}
            tabMoveToNextArea={() => onTabMoveToNextArea?.(document.id)}
            tabMoveToPreviousArea={() => onTabMoveToPreviousArea?.(document.id)}
            tabSplitRight={onSplitRight}
            tabSplitDown={onSplitDown}
            tabDragEnd={() => {
              setDraggedTabId(undefined);
              setDragOver(undefined);
              setIsAppendingAfterLastTab(false);
            }}
            tabDragLeave={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                event.currentTarget.contains(event.relatedTarget)
              ) {
                return;
              }
              setDragOver((current) => current?.id === document.id ? undefined : current);
            }}
            tabDragOver={(event) => {
              if (
                !hasDocumentTabDragData(event, draggedTabId) ||
                draggedTabId === document.id
              ) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setIsAppendingAfterLastTab(false);
              setDragOver({
                id: document.id,
                placement: getDropPlacement(event)
              });
            }}
            tabDragStart={(event) => {
              setDraggedTabId(document.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", document.id);
              event.dataTransfer.setData(
                DOCUMENT_TAB_DRAG_MIME,
                JSON.stringify({
                  areaId,
                  documentId: document.id
                } satisfies DocumentTabDragData)
              );
            }}
            tabDrop={(event) => {
              const dragData = getDocumentTabDragData(event, draggedTabId);
              const sourceId = dragData?.documentId;
              if (!sourceId || (sourceId === document.id && dragData?.areaId === areaId)) return;
              event.preventDefault();
              event.stopPropagation();
              const placement = getDropPlacement(event);
              setDraggedTabId(undefined);
              setDragOver(undefined);
              setIsAppendingAfterLastTab(false);
              const sourceAreaId = dragData?.areaId === areaId ? undefined : dragData?.areaId;
              if (sourceAreaId) {
                onTabMoved(sourceId, document.id, placement === "after", sourceAreaId);
              } else {
                onTabMoved(sourceId, document.id, placement === "after");
              }
            }}
          />
        );
      })}
    </div>
  );
}

function getDocumentTabDragData(
  event: DragEvent<HTMLElement>,
  localDocumentId?: string
): DocumentTabDragData | undefined {
  const serializedData = event.dataTransfer.getData(DOCUMENT_TAB_DRAG_MIME);
  if (serializedData) {
    try {
      return JSON.parse(serializedData) as DocumentTabDragData;
    } catch {
      // Fall through to the legacy text/plain payload.
    }
  }

  const documentId = localDocumentId ?? event.dataTransfer.getData("text/plain");
  return documentId ? { documentId } : undefined;
}

/**
 * Browser drag events expose the MIME type while hovering, but can withhold the
 * payload until the drop event. The destination hub must accept the drag before
 * it can read the document and area identifiers.
 */
function hasDocumentTabDragData(
  event: DragEvent<HTMLElement>,
  localDocumentId?: string
): boolean {
  return (
    !!localDocumentId ||
    Array.from(event.dataTransfer.types).includes(DOCUMENT_TAB_DRAG_MIME)
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
