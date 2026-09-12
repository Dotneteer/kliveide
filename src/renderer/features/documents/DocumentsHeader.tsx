import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { CloseMode } from "./DocumentTab";
import { DocumentCommandBar } from "./DocumentCommandBar";
import { DocumentTabs, getDocumentTabLabels } from "./DocumentTabs";
import {
  useActiveDocumentAreaId,
  useDocumentAreaGridApi,
  useDocumentAreaId
} from "./DocumentAreaGridContext";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
import styles from "./DocumentsHeader.module.scss";
import {
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "@renderer/appIde/services/DocumentServiceProvider";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { incProjectViewStateVersionAction } from "@common/state/actions";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import ScrollViewer, { ScrollViewerApi } from "@renderer/controls/ScrollViewer";
import { SmallIconButton } from "@renderer/controls/IconButton";
import {
  ContextMenu,
  ContextMenuItem,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import {
  DOCS_WORKSPACE,
  DocumentWorkspace,
  SavedDocumentInfo
} from "./useDocumentWorkspacePersistence";

/**
 * Renders the document tab strip and document command bar, bridges tab actions to
 * the hub service, and keeps the active tab visible and persisted in workspace state.
 */
export const DocumentsHeader = () => {
  const dispatch = useDispatch();
  const { store } = useRendererContext();
  const { projectService } = useAppServices();
  const documentHubService = useDocumentHubService();
  const documentAreaGridApi = useDocumentAreaGridApi();
  const documentAreaId = useDocumentAreaId();
  const activeDocumentAreaId = useActiveDocumentAreaId();
  const documentAreaState = documentAreaGridApi?.getActiveAreaState();
  useDocumentHubServiceVersion();
  const handlersInitialized = useRef(false);
  const projectVersion = useSelector((s) => s.project?.projectFileVersion);
  const isProjectDebugging = useSelector((s) => s.emulatorState?.isProjectDebugging ?? false);
  const [awaiting, setAwaiting] = useState(false);
  const buildRoots = useSelector((s) => s.project?.buildRoots ?? EMPTY_ARRAY);
  // Subscribe so dirty flags refresh when editor changes update service-owned document objects.
  useSelector((s) => s.ideView?.editorVersion);

  const svApi = useRef<ScrollViewerApi>();
  const tabDims = useRef<HTMLDivElement[]>([]);
  const tabVisibilityEffectInitialized = useRef(false);
  const [overflow, setOverflow] = useState<TabOverflow>(NO_OVERFLOW);
  const [tabListState, tabListApi] = useContextMenuState();
  const tabListAnchor = useRef<HTMLSpanElement>(null);

  const openDocs = documentHubService.getOpenDocuments();
  const activeDocIndex = documentHubService.getActiveDocumentIndex();
  const activeDoc = openDocs?.[activeDocIndex];
  const activeNode = activeDoc?.node;
  const dirtyStates = openDocs?.map((d) => d.editVersionCount !== d.savedVersionCount);
  const selectedIsBuildRoot = activeNode?.projectPath
    ? buildRoots.indexOf(activeNode.projectPath) >= 0
    : false;
  const editorInfo = getFileTypeEntry(activeNode?.name, store);

  // --- Ensures that the active document tab is visible in its full size
  const ensureTabVisible = useCallback(() => {
    const tabDim = tabDims.current[activeDocIndex];
    if (!tabDim) return;
    if (!svApi.current) return;

    // --- There is an active document
    const tabLeftPos = tabDim.offsetLeft;
    const tabRightPos = tabLeftPos + tabDim.offsetWidth;
    const scrollPos = svApi.current.getScrollLeft();
    const clientWidth = svApi.current.getClientWidth();
    if (tabLeftPos < scrollPos) {
      // --- Left tab edge is hidden, scroll to the left to display the tab
      svApi.current.scrollToHorizontal(tabLeftPos);
    } else if (tabRightPos > scrollPos + clientWidth) {
      // --- Right tab edge is hidden, scroll to the left to display the tab
      svApi.current.scrollToHorizontal(tabLeftPos - clientWidth + tabDim.offsetWidth);
    }
  }, [activeDocIndex]);

  /*
   * Which tabs the strip is currently showing.
   *
   * `ScrollViewerApi` exposes no scroll width, but the tab elements are already collected in
   * `tabDims` for `ensureTabVisible`, so the content width is the right edge of the last tab. That
   * keeps the overflow signal in this component instead of widening a shared control's API.
   */
  const measureOverflow = useCallback(() => {
    const api = svApi.current;
    const tabs = tabDims.current.filter(Boolean);
    if (!api || !tabs.length) {
      setOverflow((prev) => (prev === NO_OVERFLOW ? prev : NO_OVERFLOW));
      return;
    }
    const contentWidth = Math.max(...tabs.map((t) => t.offsetLeft + t.offsetWidth));
    const clientWidth = api.getClientWidth();
    const scrollLeft = api.getScrollLeft();
    const hidden = new Set<number>();
    tabDims.current.forEach((tab, idx) => {
      if (!tab) return;
      const left = tab.offsetLeft;
      const right = left + tab.offsetWidth;
      // A tab counts as hidden when either edge is outside the viewport, matching what the eye sees.
      if (left < scrollLeft - 1 || right > scrollLeft + clientWidth + 1) hidden.add(idx);
    });
    const next: TabOverflow = {
      active: contentWidth > clientWidth + 1,
      canLeft: scrollLeft > 1,
      canRight: scrollLeft + clientWidth < contentWidth - 1,
      hidden
    };
    setOverflow((prev) => (sameOverflow(prev, next) ? prev : next));
  }, []);

  /*
   * Both callbacks must be stable across renders. `useTabVisibility` feeds `ensureVisible` into a
   * `useCallback([ensureVisible])`, and the `schedule` function that comes back is itself a
   * dependency of the effect below - so an inline arrow here (a fresh identity every render)
   * made that effect re-fire, and `ensureTabVisible()` re-run, on every unrelated re-render of
   * this component. On a narrow strip that is not a no-op: if the active tab does not fit in the
   * current scroll position, `ensureTabVisible` snaps back to reveal it - which is exactly what
   * happens right after a "scroll tabs" click, since `scrollTabsBy` calls `measureOverflow()`,
   * which sets state, which re-renders, which (with the old inline arrows) re-scheduled this and
   * undid the click. `ensureTabVisible` already depends on `activeDocIndex`, so memoizing on that
   * (plus the stable `measureOverflow`) keeps the one re-trigger that is actually wanted: revealing
   * the newly active tab when the active document changes.
   */
  const ensureActiveTabVisible = useCallback(() => {
    ensureTabVisible();
    measureOverflow();
  }, [ensureTabVisible, measureOverflow]);
  const getTabStrip = useCallback(
    () => tabDims.current.find(Boolean)?.parentElement ?? undefined,
    []
  );
  const { schedule: scheduleEnsureTabVisible, observeElement: observeTabElement } =
    useTabVisibility(ensureActiveTabVisible, getTabStrip);

  // Scroll the strip by most of a viewport, leaving a sliver of context like a page-scroll does.
  const scrollTabsBy = (direction: -1 | 1) => {
    const api = svApi.current;
    if (!api) return;
    const step = Math.max(api.getClientWidth() - 40, 40);
    api.scrollToHorizontal(Math.max(api.getScrollLeft() + direction * step, 0));
    measureOverflow();
  };
  const scrollViewerApiLoaded = useCallback((api: ScrollViewerApi) => {
    svApi.current = api;
    scheduleEnsureTabVisible();
  }, [scheduleEnsureTabVisible]);

  useEffect(() => {
    if (!tabVisibilityEffectInitialized.current) {
      tabVisibilityEffectInitialized.current = true;
      return;
    }
    scheduleEnsureTabVisible();
  }, [activeDocIndex, openDocs, scheduleEnsureTabVisible]);

  // --- Refresh the changed project document
  useEffect(() => {
    const projectClosed = !store.getState().project?.folderPath;
    if (projectClosed) return;

    // --- Get the data of the document
    (async () => {
      // --- Check if the project document is visible
      const projectDoc = await documentHubService.getOpenProjectFileDocument();
      if (!projectDoc) return;

      // --- Refresh the contents of the document
      const viewState = documentHubService.getDocumentViewState(projectDoc.id);
      documentHubService.setDocumentViewState(projectDoc.id, viewState);
      setTimeout(() => dispatch(incProjectViewStateVersionAction()), 1000);
    })();
  }, [dispatch, documentHubService, projectVersion, store]);

  // --- Respond to project service notifications
  useEffect(() => {
    if (handlersInitialized.current || !projectService) return;

    // --- Remove open explorer document when the folder is closed
    const projectClosed = () => {
      documentHubService.closeAllExplorerDocuments();
    };

    // --- Set up project event handlers
    handlersInitialized.current = true;
    projectService.projectClosed.on(projectClosed);

    // --- Remove project event handlers
    return () => {
      handlersInitialized.current = false;
      projectService.projectClosed.off(projectClosed);
    };
  }, [documentHubService, projectService]);

  // --- Stores the tab element reference, as later we'll need its dimensions to
  // --- ensure it is entirelly visible
  const tabDisplayed = useCallback((idx: number, el: HTMLDivElement) => {
    const oldTabElement = tabDims.current[idx];
    tabDims.current[idx] = el;
    // DocumentTab reports itself from a dep-less `useLayoutEffect`, so this runs on every one of
    // its renders, not only on mount - guard so a new element (a new tab, or the strip on the
    // very first tab) is only handed to the observer once.
    if (oldTabElement !== el) {
      observeTabElement(el);
    }
    if (!oldTabElement) {
      scheduleEnsureTabVisible();
    }
  }, [observeTabElement, scheduleEnsureTabVisible]);

  // --- Responds to the event when a document tab has been clicked; it makes the clicked
  // --- document the active one
  const tabClicked = async (id: string) => {
    // --- Do not change, if clicking the active document tab
    const activeDocId = openDocs?.[activeDocIndex]?.id;
    if (!activeDocId || id === activeDocId) return;

    setAwaiting(true);
    await documentHubService.setActiveDocument(id).finally(() => setAwaiting(false));
  };

  // --- Responds to the event when a document tab was double clicked. Double clicking
  // --- makes a temporary document permanent.
  const tabDoubleClicked = (d: ProjectDocumentState) => {
    documentHubService.setPermanent(d.id);
  };

  // --- Responds to the event when the close button of the tab is clicked
  const tabCloseClicked = (mode: CloseMode, id: string) => {
    async function onTabCloseAsync() {
      switch (mode) {
        case CloseMode.All:
          await documentHubService.closeAllDocuments();
          break;
        case CloseMode.Others:
          await documentHubService.closeAllDocuments(id);
          break;
        default:
          await documentHubService.closeDocument(id);
          break;
      }
    }
    setAwaiting(true);
    onTabCloseAsync().finally(() => setAwaiting(false));
  };

  const tabMoved = async (
    sourceId: string,
    targetId: string,
    after: boolean,
    sourceAreaId?: string
  ) => {
    if (
      sourceAreaId &&
      documentAreaId &&
      sourceAreaId !== documentAreaId &&
      documentAreaGridApi
    ) {
      await documentAreaGridApi.moveDocumentToArea(
        sourceAreaId,
        documentAreaId,
        sourceId,
        targetId,
        after
      );
      return;
    }

    documentHubService.moveDocument(sourceId, targetId, after);
  };

  const moveTab = (documentId: string, offset: -1 | 1) => {
    const sourceIndex = openDocs?.findIndex((document) => document.id === documentId) ?? -1;
    const targetDocument = openDocs?.[sourceIndex + offset];
    if (sourceIndex < 0 || !targetDocument) return;

    documentHubService.moveDocument(documentId, targetDocument.id, offset > 0);
  };

  const tabLabels = getDocumentTabLabels(openDocs ?? []);

  const tabsCount = openDocs?.length ?? 0;
  if (tabsCount <= 0) {
    return null;
  }

  return (
    <div className={styles.documentsHeader}>
      <ScrollViewer
        allowHorizontal={true}
        allowVertical={false}
        thinScrollBar={true}
        apiLoaded={scrollViewerApiLoaded}
        onScrolled={measureOverflow}
      >
        <DocumentTabs
          activeDocIndex={activeDocIndex}
          areaId={documentAreaId}
          isInActiveArea={!activeDocumentAreaId || documentAreaId === activeDocumentAreaId}
          awaiting={awaiting}
          dirtyStates={dirtyStates}
          isProjectDebugging={isProjectDebugging}
          openDocs={openDocs ?? []}
          onTabClicked={tabClicked}
          onTabCloseClicked={tabCloseClicked}
          onTabDisplayed={tabDisplayed}
          onTabDoubleClicked={tabDoubleClicked}
          onTabMoveLeft={(documentId) => moveTab(documentId, -1)}
          onTabMoveRight={(documentId) => moveTab(documentId, 1)}
          onTabMoveToNextArea={
            documentAreaGridApi && documentAreaId && documentAreaState?.hasNextArea
              ? async (documentId) =>
                  await documentAreaGridApi.moveActiveDocumentToNextArea(documentId)
              : undefined
          }
          onTabMoveToPreviousArea={
            documentAreaGridApi && documentAreaId && documentAreaState?.hasPreviousArea
              ? async (documentId) =>
                  await documentAreaGridApi.moveActiveDocumentToPreviousArea(documentId)
              : undefined
          }
          onSplitRight={
            documentAreaGridApi && documentAreaId
              ? async () => await documentAreaGridApi.splitActiveArea("horizontal")
              : undefined
          }
          onSplitDown={
            documentAreaGridApi && documentAreaId
              ? async () => await documentAreaGridApi.splitActiveArea("vertical")
              : undefined
          }
          onTabMoved={tabMoved}
          tabsCount={tabsCount}
        />
        <div className={styles.closingTab} />
      </ScrollViewer>
      {overflow.active && (
        /*
         * Shown only when the strip cannot fit its tabs.
         *
         * Before this the header relied on horizontal scrolling alone, with no indication that
         * there was anything to scroll to — the only way to discover a hidden tab was to drag the
         * thin scrollbar or to already know it was there.
         */
        <div className={styles.overflowControls}>
          <SmallIconButton
            iconName="chevron-left"
            title="Scroll tabs left"
            enable={overflow.canLeft}
            clicked={() => scrollTabsBy(-1)}
          />
          <SmallIconButton
            iconName="chevron-right"
            title="Scroll tabs right"
            enable={overflow.canRight}
            clicked={() => scrollTabsBy(1)}
          />
          <span ref={tabListAnchor}>
            <SmallIconButton
              iconName="ellipsis"
              title="Show all open documents"
              clicked={() => tabListApi.showAt(tabListAnchor.current)}
            />
          </span>
          <ContextMenu
            state={tabListState}
            placement="bottom-end"
            onClickOutside={tabListApi.conceal}
          >
            {(openDocs ?? []).map((doc, idx) => (
              <ContextMenuItem
                key={doc.id}
                /*
                 * Name, icon and fill come from the document itself — the same three values
                 * `DocumentTabs` hands to each tab — so a row looks like the tab it stands for.
                 * Deriving them here instead (from the file type) silently produced no icon at all
                 * for the virtual documents, which have no node.
                 */
                text={tabLabels.get(doc.id) ?? doc.name}
                iconName={doc.iconName ?? "file-code"}
                iconFill={doc.iconFill ?? "--color-doc-icon"}
                selected={idx === activeDocIndex}
                /*
                 * The list holds every open document, not only the hidden ones, so it doubles as a
                 * switcher and its contents do not shift as the window is resized. Hidden tabs are
                 * marked rather than filtered.
                 */
                trailing={
                  <>
                    {dirtyStates?.[idx] ? "\u25CF" : ""}
                    {overflow.hidden.has(idx) ? " \u00B7\u00B7\u00B7" : ""}
                  </>
                }
                clicked={() => {
                  tabListApi.conceal();
                  void tabClicked(doc.id);
                }}
              />
            ))}
          </ContextMenu>
        </div>
      )}
      {tabsCount > 0 && (
        <DocumentCommandBar
          activeFullPath={activeNode?.fullPath}
          editorInfo={editorInfo}
          selectedIsBuildRoot={selectedIsBuildRoot}
        />
      )}
    </div>
  );
};

export type { DocumentWorkspace, SavedDocumentInfo };
export { DOCS_WORKSPACE };

/** What the tab strip can currently show, and what it cannot. */
type TabOverflow = {
  active: boolean;
  canLeft: boolean;
  canRight: boolean;
  hidden: Set<number>;
};

const NO_OVERFLOW: TabOverflow = {
  active: false,
  canLeft: false,
  canRight: false,
  hidden: new Set()
};

/*
 * Measurement runs on every scroll and every resize, so it must not hand back a fresh object each
 * time — that would re-render the header continuously while the strip is being dragged.
 */
function sameOverflow(a: TabOverflow, b: TabOverflow): boolean {
  if (a.active !== b.active || a.canLeft !== b.canLeft || a.canRight !== b.canRight) return false;
  if (a.hidden.size !== b.hidden.size) return false;
  for (const idx of a.hidden) if (!b.hidden.has(idx)) return false;
  return true;
}

/**
 * Keeps the active document tab fully in view.
 *
 * The previous implementation called `ensureTabVisible` five times for every change — immediately,
 * inside a `requestAnimationFrame`, and again on timeouts at 0ms, 50ms and 150ms. That ladder
 * existed because tab geometry is not settled when the effect runs (layout, fonts and the
 * ScrollViewer's own measurement all land later) and there was no signal for when it would be, so
 * the code guessed at several plausible moments and hoped one of them was right.
 *
 * A `ResizeObserver` is that signal. It fires when the strip has actually been laid out, so one
 * scheduled call plus the observer replaces all five guesses — and it also covers the cases the
 * timeouts never could, such as the window being resized or a long filename arriving late.
 *
 * The observer itself is created once and lives for the strip's lifetime; callers register new tab
 * elements through `observeElement` as they mount (see `tabDisplayed`) instead of this hook
 * rebuilding the observer on every render. Rebuilding used to be exactly the bug: a `ResizeObserver`
 * delivers an initial entry for every target the moment it starts observing it, even when nothing
 * has actually resized, so tearing the observer down and recreating it on each unrelated re-render
 * of `DocumentsHeader` re-fired `schedule()` — and thereby `ensureTabVisible()` — constantly. On a
 * strip too narrow to show the active tab at every scroll position, that meant the active tab got
 * yanked back into view on almost every render, overriding any manual scroll before the user could
 * see the result. jsdom has no `ResizeObserver`, so this path is invisible to component tests here;
 * it only shows up in a real browser.
 */
function useTabVisibility(
  ensureTabVisible: () => void,
  getStrip: () => HTMLElement | undefined
): { schedule: () => void; observeElement: (el: HTMLElement) => void } {
  const frameRef = useRef<number>();
  const observerRef = useRef<ResizeObserver>();
  const observedStripRef = useRef<HTMLElement>();
  // `DocumentTab` reports itself from a dep-less `useLayoutEffect`, and on the very first commit
  // every child's layout effects run before this hook's own (regular) effect creates the observer
  // - so the opening batch of tabs always calls `observeElement` before `observerRef.current`
  // exists. Queue them here and flush the queue once the observer is ready, instead of silently
  // dropping them (which would leave the opening tabs unobserved until something else happened to
  // reschedule).
  const pendingRef = useRef<Set<HTMLElement>>(new Set());

  const schedule = useCallback(() => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      ensureTabVisible();
    });
  }, [ensureTabVisible]);

  // `schedule` changes identity whenever `ensureTabVisible` does (e.g. the active tab changes),
  // but the observer below is built exactly once - so its callback reads `schedule` through this
  // ref rather than closing over the value from whichever render created it.
  const scheduleRef = useRef(schedule);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  // Observing the children as well as the strip catches a single tab changing width — a rename,
  // or a dirty marker appearing — which does not necessarily resize the strip itself.
  const observeWithStrip = useCallback(
    (observer: ResizeObserver, el: HTMLElement) => {
      observer.observe(el);
      if (observedStripRef.current) return;
      const strip = getStrip();
      if (strip) {
        observer.observe(strip);
        observedStripRef.current = strip;
      }
    },
    [getStrip]
  );

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => scheduleRef.current());
    observerRef.current = observer;
    for (const el of pendingRef.current) observeWithStrip(observer, el);
    pendingRef.current.clear();
    return () => {
      observer.disconnect();
      observerRef.current = undefined;
      observedStripRef.current = undefined;
    };
  }, [observeWithStrip]);

  const observeElement = useCallback(
    (el: HTMLElement) => {
      const observer = observerRef.current;
      if (!observer) {
        pendingRef.current.add(el);
        return;
      }
      observeWithStrip(observer, el);
    },
    [observeWithStrip]
  );

  useEffect(
    () => () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  return { schedule, observeElement };
}
