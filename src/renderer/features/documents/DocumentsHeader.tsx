import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { CloseMode } from "./DocumentTab";
import { DocumentCommandBar } from "./DocumentCommandBar";
import { DocumentTabs } from "./DocumentTabs";
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
import { useMainApi } from "@renderer/core/MainApi";
import {
  DOCS_WORKSPACE,
  DocumentWorkspace,
  SavedDocumentInfo,
  useDocumentWorkspacePersistence
} from "./useDocumentWorkspacePersistence";

/**
 * Renders the document tab strip and document command bar, bridges tab actions to
 * the hub service, and keeps the active tab visible and persisted in workspace state.
 */
export const DocumentsHeader = () => {
  const dispatch = useDispatch();
  const mainApi = useMainApi();
  const { store } = useRendererContext();
  const { projectService } = useAppServices();
  const documentHubService = useDocumentHubService();
  useDocumentHubServiceVersion();
  const handlersInitialized = useRef(false);
  const projectVersion = useSelector((s) => s.project?.projectFileVersion);
  const isProjectDebugging = useSelector((s) => s.emulatorState?.isProjectDebugging ?? false);
  const [awaiting, setAwaiting] = useState(false);
  const buildRoots = useSelector((s) => s.project?.buildRoots ?? EMPTY_ARRAY);
  // Subscribe so dirty flags refresh when editor changes update service-owned document objects.
  useSelector((s) => s.ideView?.editorVersion);
  const workspaceLoaded = useSelector((s) => s.project?.workspaceLoaded ?? false);

  const svApi = useRef<ScrollViewerApi>();
  const tabDims = useRef<HTMLDivElement[]>([]);

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

  const scheduleEnsureTabVisible = useScheduledTabVisibility(ensureTabVisible);
  const scrollViewerApiLoaded = useCallback((api: ScrollViewerApi) => {
    svApi.current = api;
    scheduleEnsureTabVisible();
  }, [scheduleEnsureTabVisible]);

  useDocumentWorkspacePersistence({
    activeDocIndex,
    ensureTabVisible: scheduleEnsureTabVisible,
    mainApi,
    openDocs,
    store,
    workspaceLoaded
  });

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

  const tabsCount = openDocs?.length ?? 0;
  return tabsCount > 0 ? (
    <div className={styles.documentsHeader}>
      <ScrollViewer
        allowHorizontal={true}
        allowVertical={false}
        thinScrollBar={true}
        apiLoaded={scrollViewerApiLoaded}
      >
        <DocumentTabs
          activeDocIndex={activeDocIndex}
          awaiting={awaiting}
          dirtyStates={dirtyStates}
          isProjectDebugging={isProjectDebugging}
          openDocs={openDocs ?? []}
          onTabClicked={tabClicked}
          onTabCloseClicked={tabCloseClicked}
          onTabDisplayed={tabDisplayed}
          onTabDoubleClicked={tabDoubleClicked}
          onTabMoved={(sourceId, targetId, after) =>
            documentHubService.moveDocument(sourceId, targetId, after)
          }
          tabsCount={tabsCount}
        />
        <div className={styles.closingTab} />
      </ScrollViewer>
      <DocumentCommandBar
        activeFullPath={activeNode?.fullPath}
        editorInfo={editorInfo}
        selectedIsBuildRoot={selectedIsBuildRoot}
        onCloseAll={async () => await documentHubService.closeAllDocuments()}
      />
    </div>
  ) : null;
};

export type { DocumentWorkspace, SavedDocumentInfo };
export { DOCS_WORKSPACE };

function useScheduledTabVisibility(ensureTabVisible: () => void): () => void {
  const animationFrameRef = useRef<number>();
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearScheduledVisibility = useCallback(() => {
    if (animationFrameRef.current !== undefined) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutRefs.current = [];
  }, []);

  useEffect(() => clearScheduledVisibility, [clearScheduledVisibility]);

  return useCallback(() => {
    clearScheduledVisibility();
    ensureTabVisible();
    animationFrameRef.current = requestAnimationFrame(() => ensureTabVisible());
    timeoutRefs.current.push(
      setTimeout(() => ensureTabVisible(), 0),
      setTimeout(() => ensureTabVisible(), 50),
      setTimeout(() => ensureTabVisible(), 150)
    );
  }, [clearScheduledVisibility, ensureTabVisible]);
}
