import { ScrollViewer, ScrollViewerApi } from "@controls/ScrollViewer";
import {
  TabButton,
  TabButtonSeparator,
  TabButtonSpace
} from "@controls/TabButton";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useRef, useState } from "react";
import { useAppServices } from "../services/AppServicesProvider";
import { DocumentTab } from "./DocumentTab";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
import styles from "./DocumentsHeader.module.scss";
import { delay, delayAction } from "@renderer/utils/timing";
import {
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "../services/DocumentServiceProvider";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

/**
 * This component represents the header of a document hub
 */
export const DocumentsHeader = () => {
  const { projectService } = useAppServices();
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();
  const handlersInitialized = useRef(false);
  const projectVersion = useSelector(s => s.project?.projectFileVersion);
  const [openDocs, setOpenDocs] = useState<ProjectDocumentState[]>(null);
  const [activeDocIndex, setActiveDocIndex] = useState<number>(null);
  const [selectedIsBuildRoot, setSelectedIsBuildRoot] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const buildRoots = useSelector(s => s.project?.buildRoots ?? EMPTY_ARRAY);

  const svApi = useRef<ScrollViewerApi>();
  const tabDims = useRef<HTMLDivElement[]>([]);

  // --- Prepare the open documents to display
  useEffect(() => {
    if (!documentHubService) return;
    setOpenDocs(documentHubService.getOpenDocuments());
    setActiveDocIndex(documentHubService.getActiveDocumentIndex());
  }, [hubVersion]);

  // --- Update the UI when the build root changes
  useEffect(() => {
    if (openDocs) {
      setSelectedIsBuildRoot(
        buildRoots.indexOf(openDocs[activeDocIndex]?.node?.projectPath) >= 0
      );
    }
  }, [openDocs, buildRoots, activeDocIndex]);

  // --- Make sure that the index is visible
  useEffect(() => {
    ensureTabVisible();
  }, [activeDocIndex, selectedIsBuildRoot]);

  // --- Update the UI when the build root changes
  useEffect(() => {
    if (openDocs) {
      setSelectedIsBuildRoot(
        buildRoots.indexOf(openDocs[activeDocIndex]?.node?.projectPath) >= 0
      );
    }
  }, [openDocs, buildRoots, activeDocIndex]);

  // --- Make sure that the index is visible
  useEffect(() => {
    ensureTabVisible();
  }, [activeDocIndex, selectedIsBuildRoot]);

  // --- Refresh the changed project document
  useEffect(() => {
    // --- Check if the project document is visible
    const projectDoc = documentHubService.getOpenProjectFileDocument();
    if (!projectDoc) return;

    // --- Get the data of the document
    (async () => {
      const data = documentHubService.getDocumentData(projectDoc.id);
      const viewState = data?.viewState;
      const contents = await projectService.readFileContent(projectDoc.path);
      // --- Refresh the contents of the document
      documentHubService.setDocumentData(projectDoc.id, {
        value: contents,
        viewState
      });
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
      svApi.current.scrollToHorizontal(
        tabLeftPos - parent.offsetWidth + tabDim.offsetWidth
      );
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

    // --- Make sure to save the state of the active document gracefully
    const docApi = documentHubService.getDocumentApi(activeDocId);
    try {
      await delayAction(
        async () => {
          if (docApi?.saveDocumentState) {
            await docApi.saveDocumentState();
          }
        },
        () => setAwaiting(true)
      );

      // --- Now, activate the document
      documentHubService.setActiveDocument(id);
    } finally {
      setAwaiting(false);
    }
  };

  // --- Responds to the event when a document tab was double clicked. Double clicking
  // --- makes a temporary document permanent.
  const tabDoubleClicked = (d: ProjectDocumentState) => {
    projectService.setPermanent(d.id);
  };

  // --- Responds to the event when the close button of the tab is clicked
  const tabCloseClicked = (id: string) => {
    documentHubService.closeDocument(id);
  };

  return (openDocs?.length ?? 0) > 0 ? (
    <div className={styles.documentsHeader}>
      <ScrollViewer
        allowHorizontal={true}
        allowVertical={false}
        scrollBarWidth={4}
        apiLoaded={api => (svApi.current = api)}
      >
        <div className={styles.tabWrapper}>
          {(openDocs ?? []).map((d, idx) => {
            // --- Take care of unique names
            const docName = openDocs.find(
              doc => doc.name === d.name && doc.id !== d.id && doc.path
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
                iconName={d.iconName}
                iconFill={d.iconFill}
                tabDisplayed={el => tabDisplayed(idx, el)}
                tabClicked={() => tabClicked(d.id)}
                tabDoubleClicked={() => tabDoubleClicked(d)}
                tabCloseClicked={() => tabCloseClicked(d.id)}
              />
            );
          })}
        </div>
        <div className={styles.closingTab} />
      </ScrollViewer>
      <div className={styles.commandBar}>
        {selectedIsBuildRoot && <BuildRootCommandBar />}
        <TabButtonSeparator />
        <TabButton
          iconName='arrow-small-left'
          title={"Move the active\ntab to left"}
          disabled={activeDocIndex === 0}
          useSpace={true}
          clicked={() => documentHubService.moveActiveToLeft()}
        />
        <TabButton
          iconName='arrow-small-right'
          title={"Move the active\ntab to right"}
          disabled={activeDocIndex === (openDocs?.length ?? 0) - 1}
          useSpace={true}
          clicked={() => documentHubService.moveActiveToRight()}
        />
        <TabButton
          iconName='close'
          useSpace={true}
          clicked={() => documentHubService.closeAllDocuments()}
        />
      </div>
    </div>
  ) : null;
};

// --- Encapsulates the command bar to use with the build root document
const BuildRootCommandBar = () => {
  const { outputPaneService, ideCommandsService } = useAppServices();
  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName='combine'
        title='Compile code'
        clicked={async () => {
          const buildPane = outputPaneService.getOutputPaneBuffer("build");
          await ideCommandsService.executeCommand("compile", buildPane);
          await ideCommandsService.executeCommand("outp build");
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName='inject'
        title={"Inject code into\nthe virtual machine"}
        clicked={async () => {
          const buildPane = outputPaneService.getOutputPaneBuffer("build");
          await ideCommandsService.executeCommand("inject", buildPane);
          await ideCommandsService.executeCommand("outp build");
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName='play'
        title={"Inject code and start\nthe virtual machine"}
        clicked={async () => {
          const buildPane = outputPaneService.getOutputPaneBuffer("build");
          await ideCommandsService.executeCommand("run", buildPane);
          await ideCommandsService.executeCommand("outp build");
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName='debug'
        title={"Inject code and start\ndebugging"}
        clicked={async () => {
          const buildPane = outputPaneService.getOutputPaneBuffer("build");
          await ideCommandsService.executeCommand("debug", buildPane);
          await ideCommandsService.executeCommand("outp build");
        }}
      />
    </>
  );
};
