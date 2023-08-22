import { ScrollViewer, ScrollViewerApi } from "@controls/ScrollViewer";
import {
  TabButton,
  TabButtonSeparator,
  TabButtonSpace
} from "@controls/TabButton";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { ITreeNode } from "@renderer/core/tree-node";
import { documentPanelRegistry } from "@renderer/registry";
import {
  activateDocumentAction,
  changeDocumentAction,
  closeDocumentAction,
  incDocumentActivationVersionAction,
} from "@state/actions";
import { useEffect, useRef, useState } from "react";
import { ProjectNode } from "../project/project-node";
import { useAppServices } from "../services/AppServicesProvider";
import { DocumentTab } from "./DocumentTab";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import styles from "./DocumentsHeader.module.scss";
import { delayAction } from "@renderer/utils/timing";
import { useDocumentService } from "../services/DocumentServiceProvider";

/**
 * This component represents the header of a document hub
 */
export const DocumentsHeader = () => {
  const dispatch = useDispatch();
  const { projectService } = useAppServices();
  const documentService = useDocumentService();
  const handlersInitialized = useRef(false);
  const openDocs = useSelector(s => s.ideView?.openDocuments);
  const projectVersion = useSelector(s => s.project?.projectVersion);
  const [docsToDisplay, setDocsToDisplay] = useState<DocumentInfo[]>(null);
  const [selectedIsBuildRoot, setSelectedIsBuildRoot] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const buildRoots = useSelector(s => s.project?.buildRoots ?? EMPTY_ARRAY);

  const svApi = useRef<ScrollViewerApi>();
  const tabDims = useRef<HTMLDivElement[]>([]);

  // --- Prepare the open documents to display
  useEffect(() => {
    refreshDocs();
  }, [openDocs]);

  // --- Update the UI when the build root changes
  useEffect(() => {
    if (docsToDisplay) {
      setSelectedIsBuildRoot(
        buildRoots.indexOf(
          docsToDisplay[activeDocIndex]?.node?.data?.projectPath
        ) >= 0
      );
    }
  }, [docsToDisplay, buildRoots, activeDocIndex]);

  // --- Make sure that the index is visible
  useEffect(() => {
    ensureTabVisible();
  }, [activeDocIndex, selectedIsBuildRoot]);

  // --- Refresh the changed project document
  useEffect(() => {
    // --- Check if the project document is visible
    const projectDoc = documentService.getOpenProjectFileDocument();
    if (!projectDoc) return;

    // --- Get the data of the document
    (async () => {
      const data = documentService.getDocumentData(projectDoc.id);
      const viewState = data?.viewState;
      const contents = await projectService.readFileContent(projectDoc.path);
      // --- Refresh the contents of the document
      documentService.setDocumentData(projectDoc.id, {
        value: contents,
        viewState
      });

      // --- Display the newest document version
      documentService.incrementViewVersion(projectDoc.id);
    })();
  }, [projectVersion]);

  // --- Respond to project service notifications
  useEffect(() => {
    if (handlersInitialized.current) return;

    // --- Remove open explorer document when the folder is closed
    const projectClosed = () => {
      documentService.closeAllExplorerDocuments();
    };

    // --- Open the newly added document
    const itemAdded = (node: ITreeNode<ProjectNode>) => {
      if (node.data.isFolder) return;

      // --- Open the newly added file
      documentService.openDocument(
        {
          id: node.data.fullPath,
          name: node.data.name,
          type: node.data.editor,
          language: node.data.subType,
          iconName: node.data.icon,
          node,
          viewVersion: 0
        },
        undefined,
        false
      );
    };

    // --- Refresh the renamed item's document
    const itemRenamed = ({ oldName, node }) => {
      documentService.renameDocument(
        oldName,
        node.data.fullPath,
        node.data.name,
        node.data.icon
      );
    };

    // --- Close the deleted documents
    const itemDeleted = (node: ITreeNode<ProjectNode>) => {
      node.forEachDescendant(des => {
        documentService.closeDocument(des.data.fullPath);
      });
      documentService.closeDocument(node.data.fullPath);
    };

    // --- Set up project event handlers
    if (projectService) {
      handlersInitialized.current = true;
      projectService.projectClosed.on(projectClosed);
      projectService.itemAdded.on(itemAdded);
      projectService.itemRenamed.on(itemRenamed);
      projectService.itemDeleted.on(itemDeleted);
    }

    // --- Remove project event handlers
    () => {
      handlersInitialized.current = false;
      if (projectService) {
        handlersInitialized.current = true;
        projectService.projectClosed.off(projectClosed);
        projectService.itemAdded.off(itemAdded);
        projectService.itemRenamed.off(itemRenamed);
        projectService.itemDeleted.off(itemDeleted);
      }
    };
  }, [projectService]);

  // --- Initiate refreshing the documents
  const refreshDocs = () => {
    if (openDocs) {
      const mappedDocs = openDocs.map(d => {
        const cloned: DocumentInfo = { ...d };
        const docRenderer = documentPanelRegistry.find(dp => dp.id === d?.type);

        if (docRenderer) {
          cloned.iconName ||= docRenderer.icon;
          cloned.iconFill ||= docRenderer.iconFill;
        }
        return cloned;
      });
      setDocsToDisplay(mappedDocs);
    }
  };

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
    if (id === openDocs?.[activeDocIndex]?.id) return;

    // --- Make sure to save the state of the active document gracefully
    const docApi = documentService.getDocumentApi(id);
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
      dispatch(activateDocumentAction(id));
    } finally {
      setAwaiting(false);
    }
  };

  // --- Responds to the event when a document tab was double clicked. Double clicking
  // --- makes a temporary document permanent.
  const tabDoubleClicked = (d: DocumentInfo, idx: number) => {
    if (d.isTemporary) {
      dispatch(
        changeDocumentAction(
          {
            id: d.id,
            name: d.name,
            type: d.type,
            isReadOnly: d.isReadOnly,
            isTemporary: false,
            iconName: d.iconName,
            iconFill: d.iconFill,
            language: d.language,
            path: d.path,
            stateValue: d.stateValue
          },
          idx
        )
      );
    }
    dispatch(incDocumentActivationVersionAction());
  };

  // --- Responds to the event when the close button of the tab is clicked
  const tabCloseClicked = (id: string) => {
    dispatch(closeDocumentAction(id));
    documentService.closeDocument(id);
  };

  return (docsToDisplay?.length ?? 0) > 0 ? (
    <div className={styles.documentsHeader}>
      <ScrollViewer
        allowHorizontal={true}
        allowVertical={false}
        scrollBarWidth={4}
        apiLoaded={api => (svApi.current = api)}
      >
        <div className={styles.tabWrapper}>
          {(docsToDisplay ?? []).map((d, idx) => {
            // --- Take care of unique names
            const docName = docsToDisplay.find(
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
                tabDoubleClicked={() => tabDoubleClicked(d, idx)}
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
          clicked={() => documentService.moveActiveToLeft()}
        />
        <TabButton
          iconName='arrow-small-right'
          title={"Move the active\ntab to right"}
          disabled={activeDocIndex === (docsToDisplay?.length ?? 0) - 1}
          useSpace={true}
          clicked={() => documentService.moveActiveToRight()}
        />
        <TabButton
          iconName='close'
          useSpace={true}
          clicked={() => documentService.closeAllDocuments()}
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
