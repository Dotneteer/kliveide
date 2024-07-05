import { ScrollViewer, ScrollViewerApi } from "@controls/ScrollViewer";
import { TabButton, TabButtonSeparator, TabButtonSpace } from "@controls/TabButton";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useRef, useState } from "react";
import { useAppServices } from "../services/AppServicesProvider";
import { CloseMode, DocumentTab } from "./DocumentTab";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
import styles from "./DocumentsHeader.module.scss";
import {
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "../services/DocumentServiceProvider";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { incProjectViewStateVersionAction, setRestartTarget } from "@common/state/actions";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { FileTypeEditor } from "@renderer/abstractions/FileTypePattern";
import { getFileTypeEntry } from "../project/project-node";

/**
 * This component represents the header of a document hub
 */
export const DocumentsHeader = () => {
  const dispatch = useDispatch();
  const { store } = useRendererContext();
  const { projectService } = useAppServices();
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();
  const handlersInitialized = useRef(false);
  const projectVersion = useSelector((s) => s.project?.projectFileVersion);
  const [openDocs, setOpenDocs] = useState<ProjectDocumentState[]>(null);
  const [activeDocIndex, setActiveDocIndex] = useState<number>(null);
  const [selectedIsBuildRoot, setSelectedIsBuildRoot] = useState(false);
  const [editorInfo, setEditorInfo] = useState<FileTypeEditor>();
  const [awaiting, setAwaiting] = useState(false);
  const buildRoots = useSelector((s) => s.project?.buildRoots ?? EMPTY_ARRAY);
  const editorVersion = useSelector((s) => s.ideView?.editorVersion);
  const [dirtyStates, setDirtyStates] = useState<boolean[]>();

  const svApi = useRef<ScrollViewerApi>();
  const tabDims = useRef<HTMLDivElement[]>([]);

  // --- Prepare the open documents to display
  useEffect(() => {
    if (!documentHubService) return;
    setOpenDocs(documentHubService.getOpenDocuments());
    setActiveDocIndex(documentHubService.getActiveDocumentIndex());
  }, [hubVersion]);

  useEffect(() => {
    setDirtyStates(openDocs?.map((d) => d.editVersionCount !== d.savedVersionCount));
  }, [editorVersion]);

  // --- Update the UI when the build root changes
  useEffect(() => {
    if (openDocs) {
      setSelectedIsBuildRoot(buildRoots.indexOf(openDocs[activeDocIndex]?.node?.projectPath) >= 0);
    }
    setEditorInfo(getFileTypeEntry(openDocs?.[activeDocIndex]?.node?.name, store));
  }, [openDocs, buildRoots, activeDocIndex, hubVersion]);

  // --- Make sure that the index is visible
  useEffect(() => {
    ensureTabVisible();
  }, [activeDocIndex, selectedIsBuildRoot]);

  // --- Refresh the changed project document
  useEffect(() => {
    // --- Get the data of the document
    (async () => {
      // --- Check if the project document is visible
      const projectDoc = await documentHubService.getOpenProjectFileDocument();
      if (!projectDoc) return;

      // --- Refresh the contents of the document
      const viewState = documentHubService.getDocumentViewState(projectDoc.id);
      documentHubService.setDocumentViewState(projectDoc.id, viewState);
      dispatch(incProjectViewStateVersionAction());
    })();
  }, [projectVersion]);

  // --- Respond to project service notifications
  useEffect(() => {
    if (handlersInitialized.current) return;

    // --- Remove open explorer document when the folder is closed
    const projectClosed = () => {
      documentHubService.closeAllExplorerDocuments();
    };

    // --- Set up project event handlers
    if (projectService) {
      handlersInitialized.current = true;
      projectService.projectClosed.on(projectClosed);
    }

    // --- Remove project event handlers
    () => {
      handlersInitialized.current = false;
      if (projectService) {
        handlersInitialized.current = true;
        projectService.projectClosed.off(projectClosed);
      }
    };
  }, [projectService]);

  // --- Ensures that the active document tab is visible in its full size
  const ensureTabVisible = () => {
    const tabDim = tabDims.current[activeDocIndex];
    if (!tabDim) return;
    const parent = tabDim.parentElement;
    if (!parent || !svApi.current) return;

    // --- There is an active document
    const tabLeftPos = tabDim.offsetLeft - parent.offsetLeft;
    const tabRightPos = tabLeftPos + tabDim.offsetWidth;
    const scrollPos = svApi.current.getScrollLeft();
    if (tabLeftPos < scrollPos) {
      // --- Left tab edge is hidden, scroll to the left to display the tab
      svApi.current.scrollToHorizontal(tabLeftPos);
    } else if (tabRightPos > scrollPos + parent.offsetWidth) {
      // --- Right tab edge is hidden, scroll to the left to display the tab
      svApi.current.scrollToHorizontal(tabLeftPos - parent.offsetWidth + tabDim.offsetWidth);
    }
  };

  // --- Stores the tab element reference, as later we'll need its dimensions to
  // --- ensure it is entirelly visible
  const tabDisplayed = (idx: number, el: HTMLDivElement) => {
    const oldTabElement = tabDims.current[idx];
    tabDims.current[idx] = el;
    if (!oldTabElement) {
      ensureTabVisible();
    }
  };

  // --- Responds to the event when a document tab has been clicked; it makes the clicked
  // --- document the active one
  const tabClicked = async (id: string) => {
    // --- Do not change, if clicking the active document tab
    const activeDocId = openDocs?.[activeDocIndex]?.id;
    if (!activeDocId || id === activeDocId) return;

    setAwaiting(true);
    await documentHubService.setActiveDocument(id).finally(setAwaiting.bind(false));
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
    onTabCloseAsync().finally(setAwaiting.bind(false));
  };

  const tabsCount = openDocs?.length ?? 0;
  return tabsCount > 0 ? (
    <div className={styles.documentsHeader}>
      <ScrollViewer
        allowHorizontal={true}
        allowVertical={false}
        scrollBarWidth={4}
        apiLoaded={(api) => (svApi.current = api)}
      >
        <div className={styles.tabWrapper}>
          {(openDocs ?? []).map((d, idx) => {
            // --- Take care of unique names
            const docName = openDocs.find(
              (doc) => doc.name === d.name && doc.id !== d.id && doc.path
            )
              ? d.path
              : d.name;
            return (
              <DocumentTab
                key={d.id}
                name={docName}
                path={d.path}
                isActive={idx === activeDocIndex}
                isTemporary={d.isTemporary}
                isReadOnly={d.isReadOnly}
                awaiting={awaiting}
                hasChanges={dirtyStates?.[idx]}
                tabsCount={tabsCount}
                iconName={d.iconName}
                iconFill={d.iconFill}
                tabDisplayed={(el) => tabDisplayed(idx, el)}
                tabClicked={() => tabClicked(d.id)}
                tabDoubleClicked={() => tabDoubleClicked(d)}
                tabCloseClicked={(mode: CloseMode) => tabCloseClicked(mode, d.id)}
              />
            );
          })}
        </div>
        <div className={styles.closingTab} />
      </ScrollViewer>
      <div className={styles.commandBar}>
        {editorInfo && editorInfo.documentTabRenderer?.(openDocs?.[activeDocIndex]?.node?.fullPath)}
        {selectedIsBuildRoot && <BuildRootCommandBar />}
        <TabButtonSeparator />
        <TabButton
          iconName="arrow-small-left"
          title={"Move the active\ntab to left"}
          disabled={activeDocIndex === 0}
          useSpace={true}
          clicked={() => documentHubService.moveActiveToLeft()}
        />
        <TabButton
          iconName="arrow-small-right"
          title={"Move the active\ntab to right"}
          disabled={activeDocIndex === (openDocs?.length ?? 0) - 1}
          useSpace={true}
          clicked={() => documentHubService.moveActiveToRight()}
        />
        <TabButton
          iconName="close"
          useSpace={true}
          clicked={async () => await documentHubService.closeAllDocuments()}
        />
        <TabButtonSeparator />
        <TabButton
          iconName="close"
          useSpace={true}
          clicked={async () => await documentHubService.closeAllDocuments()}
        />

      </div>
    </div>
  ) : null;
};

// --- Encapsulates the command bar to use with the build root document
const BuildRootCommandBar = () => {
  const { outputPaneService, ideCommandsService } = useAppServices();
  const storeDispatch = useDispatch();
  const compiling = useSelector((s) => s.compilation?.inProgress ?? false);
  const [startedHere, setStartedHere] = useState(false);
  const [scriptId, setScriptId] = useState<number>();

  useEffect(() => {
    if (startedHere && !compiling) {
      setStartedHere(false);
    }
  }, [compiling]);
  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="combine"
        title="Compile code"
        disabled={compiling}
        clicked={async () => {
          const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
          const result = await ideCommandsService.executeCommand(
            "run-build-function buildCode",
            buildPane
          );
          setScriptId(result?.value);
          await ideCommandsService.executeCommand(`outp ${PANE_ID_BUILD}`);
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName="inject"
        title={"Inject code into\nthe virtual machine"}
        disabled={compiling}
        clicked={async () => {
          const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
          const result = await ideCommandsService.executeCommand("run-build-function injectCode", buildPane);
          setScriptId(result?.value);
          await ideCommandsService.executeCommand(`outp ${PANE_ID_BUILD}`);
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName="play"
        title={"Inject code and start\nthe virtual machine"}
        disabled={compiling}
        clicked={async () => {
          storeDispatch(setRestartTarget("project"));
          const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
          const result = await ideCommandsService.executeCommand("run-build-function runCode", buildPane);
          setScriptId(result?.value);
          await ideCommandsService.executeCommand(`outp ${PANE_ID_BUILD}`);
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={"Inject code and start\ndebugging"}
        disabled={compiling}
        clicked={async () => {
          storeDispatch(setRestartTarget("project"));
          const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
          const result = await ideCommandsService.executeCommand("run-build-function debugCode", buildPane);
          setScriptId(result?.value);
          await ideCommandsService.executeCommand(`outp ${PANE_ID_BUILD}`);
        }}
      />
      <TabButtonSeparator />
      <TabButton
        iconName="pop-out"
        title={"Show script output"}
        disabled={compiling || !scriptId}
        clicked={async () => {
          if (scriptId > 0) {
            await ideCommandsService.executeCommand(
              `script-output ${scriptId}`
            );
          }
        }}
      />
    </>
  );
};
