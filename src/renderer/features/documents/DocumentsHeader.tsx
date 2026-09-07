import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { CloseMode } from "./DocumentTab";
import { DocumentCommandBar } from "./DocumentCommandBar";
import { DocumentTabs } from "./DocumentTabs";
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

  const scheduleEnsureTabVisible = useTabVisibility(
    ensureTabVisible,
    () => tabDims.current.find(Boolean)?.parentElement ?? undefined
  );
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
    if (!oldTabElement) {
      scheduleEnsureTabVisible();
    }
  }, [scheduleEnsureTabVisible]);

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
 */
function useTabVisibility(
  ensureTabVisible: () => void,
  getStrip: () => HTMLElement | undefined
): () => void {
  const frameRef = useRef<number>();

  const schedule = useCallback(() => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      ensureTabVisible();
    });
  }, [ensureTabVisible]);

  useEffect(() => {
    const strip = getStrip();
    if (!strip || typeof ResizeObserver === "undefined") return undefined;

    // Observing the children as well as the strip catches a single tab changing width — a rename,
    // or a dirty marker appearing — which does not necessarily resize the strip itself.
    const observer = new ResizeObserver(() => schedule());
    observer.observe(strip);
    for (const child of Array.from(strip.children)) observer.observe(child);
    return () => observer.disconnect();
  });

  useEffect(
    () => () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  return schedule;
}
