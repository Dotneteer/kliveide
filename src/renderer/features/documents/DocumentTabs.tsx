import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { CloseMode, DocumentTab } from "./DocumentTab";
import styles from "./DocumentsHeader.module.scss";
import { type DragEvent, useState } from "react";
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
  /*
   * Not memoised. `openDocs` is the hub's own array and its identity is the only thing a
   * `useMemo` here could key on — which is what broke this before the hub started replacing that
   * array rather than pushing into it (see `_openDocs` in DocumentHubService). The hub is fixed,
   * but a dozen-entry grouping is not worth re-acquiring a dependency on that invariant, and the
   * overflow list next door has always computed it this way.
   */
  const tabLabels = getDocumentTabLabels(openDocs);

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
        const docName = tabLabels.get(document.id) ?? document.name;
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

/**
 * The label every open document should show, keyed by document id.
 *
 * A document that does not share its name with another shows that bare name. One that does shows
 * the **shortest run of parent folders that tells it apart** from the others — `screen-tests/
 * klive.project` beside a plain `klive.project`, and only as deep as it has to go.
 *
 * The previous rule was "show `document.path` when the name is ambiguous", and path is absolute.
 * That produced tabs labelled
 * `/Users/dotneteer/source/kliveide/_experiments/testprojects/next/klive.project`, which then hit
 * `max-width: 360px` and `direction: rtl` on `.titleText` and rendered as
 * `…iments/testprojects/next/klive.project` — the middle of a path, with the one segment that
 * actually disambiguated it (`screen-tests/`, or its absence) clipped off the front. Every tab was
 * also inflated to its maximum width, which on a five-file strip was enough to push the first tab
 * into overflow.
 *
 * Set-wise rather than per-document because "shortest suffix that disambiguates" is not a property
 * of one document: two files can share a parent folder *name* (`src/utils/io.asm` and
 * `test/utils/io.asm`), so one level up is not always enough and only the group can say how far to
 * go.
 *
 * Exported as one map because the tab strip and the tab-overflow list must label the same document
 * the same way; deriving it twice is exactly how those two drifted apart before.
 */
export function getDocumentTabLabels(openDocs: ProjectDocumentState[]): Map<string, string> {
  const labels = new Map<string, string>();

  const byName = new Map<string, ProjectDocumentState[]>();
  for (const document of openDocs) {
    const group = byName.get(document.name);
    if (group) group.push(document);
    else byName.set(document.name, [document]);
  }

  for (const [name, group] of byName) {
    // --- Unique already, or one of them is a virtual document with no path to qualify it by.
    if (group.length === 1 || group.some((d) => !d.path)) {
      group.forEach((d) => labels.set(d.id, name));
      continue;
    }

    // --- Parent folders, nearest first, so `depth` counts outwards from the file.
    const parents = group.map((d) => splitPathSegments(d.path).slice(0, -1).reverse());
    const maxDepth = Math.max(...parents.map((p) => p.length));

    let depth = 1;
    let suffixes = qualify(parents, name, depth);
    while (new Set(suffixes).size !== suffixes.length && depth < maxDepth) {
      suffixes = qualify(parents, name, ++depth);
    }

    // --- Identical suffixes at `maxDepth` mean identical paths, which the hub already rejects as a
    // --- duplicate id. Whatever we have is then the best available label.
    group.forEach((d, i) => labels.set(d.id, suffixes[i]));
  }

  return labels;
}

/** `depth` parent folders back in front of the file name, re-reversed into reading order. */
function qualify(parents: string[][], name: string, depth: number): string[] {
  return parents.map((p) => [...p.slice(0, depth)].reverse().concat(name).join("/"));
}

/** Splits on both separators, so a Windows path qualifies the same way a POSIX one does. */
function splitPathSegments(path: string): string[] {
  return path.split(/[\\/]+/).filter((segment) => segment.length > 0);
}
