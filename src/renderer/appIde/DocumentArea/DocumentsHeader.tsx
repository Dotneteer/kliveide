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
  changeDocumentAction,
  incDocumentActivationVersionAction
} from "@state/actions";
import { useEffect, useRef, useState } from "react";
import { ProjectNode } from "../project/project-node";
import { useAppServices } from "../services/AppServicesProvider";
import styles from "./DocumentsHeader.module.scss";
import { DocumentTab } from "./DocumentTab";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";

export const DocumentsHeader = () => {
  const dispatch = useDispatch();
  const {
    documentService,
    projectService,
    outputPaneService,
    ideCommandsService
  } = useAppServices();
  const { messenger } = useRendererContext();
  const ref = useRef<HTMLDivElement>();
  const handlersInitialized = useRef(false);
  const openDocs = useSelector(s => s.ideView?.openDocuments);
  const projectVersion = useSelector(s => s.project?.projectVersion);
  const [docsToDisplay, setDocsToDisplay] = useState<DocumentInfo[]>(null);
  const [selectedIsBuildRoot, setSelectedIsBuildRoot] = useState(false);
  const activeDocIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const [headerVersion, setHeaderVersion] = useState(0);
  const buildRoots = useSelector(s => s.project?.buildRoots ?? EMPTY_ARRAY);

  const svApi = useRef<ScrollViewerApi>();
  const tabDims = useRef<HTMLDivElement[]>([]);

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

  // --- Prepare the open documents to display
  useEffect(() => {
    refreshDocs();
  }, [openDocs]);

  // --- Refresh the changed project document
  useEffect(() => {
    // --- Check if the project document is visible
    const projectDoc = documentService.getOpenProjectFileDocument();
    if (!projectDoc) return;

    // --- Get the data of the document
    (async () => {
      const data = documentService.getDocumentData(projectDoc.id);
      const viewState = data?.viewState;
      const textResponse = await messenger.sendMessage({
        type: "MainReadTextFile",
        path: projectDoc.path
      });
      if (textResponse.type === "ErrorResponse") {
        reportMessagingError(
          `Error displaying message dialog: ${textResponse.message}`
        );
      } else if (textResponse.type !== "TextContents") {
        reportUnexpectedMessageType(textResponse.type);
      } else {
        // --- Refresh the contents of the document
        documentService.setDocumentData(projectDoc.id, {
          value: textResponse.contents,
          viewState
        });

        // --- Display the newest document version
        documentService.incrementViewVersion(projectDoc.id);
      }
    })();
  }, [projectVersion]);

  // --- Respond to active document tab changes: make sure that the activated tab is displayed
  // --- entirely. If necessary, scroll in the active tab
  useEffect(() => {
    const tabDim = tabDims.current[activeDocIndex];
    if (!tabDim || !ref.current) return;
    const parent = tabDim.parentElement;
    if (!parent) return;

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

    // --- Check for build root
    setSelectedIsBuildRoot(
      buildRoots.indexOf(
        docsToDisplay[activeDocIndex]?.node?.data?.projectPath
      ) >= 0
    );
  }, [activeDocIndex, headerVersion, docsToDisplay, buildRoots]);

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

  return (docsToDisplay?.length ?? 0) > 0 ? (
    <div ref={ref} className={styles.documentsHeader}>
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
                index={idx}
                id={d.id}
                name={docName}
                path={d.path}
                type={d.type}
                isActive={idx === activeDocIndex}
                isTemporary={d.isTemporary}
                isReadOnly={d.isReadOnly}
                iconName={d.iconName}
                iconFill={d.iconFill}
                language={d.language}
                viewVersion={d.viewVersion}
                tabDisplayed={el => {
                  tabDims.current[idx] = el;
                }}
                tabClicked={() => setHeaderVersion(headerVersion + 1)}
                tabDoubleClicked={() => {
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
                }}
              />
            );
          })}
        </div>
        <div className={styles.closingTab} />
      </ScrollViewer>
      <div className={styles.commandBar}>
        {selectedIsBuildRoot && (
          <>
            <TabButtonSeparator />
            <TabButton
              iconName='combine'
              title='Compile code'
              clicked={async () => {
                const buildPane =
                  outputPaneService.getOutputPaneBuffer("build");
                await ideCommandsService.executeCommand("compile", buildPane);
                await ideCommandsService.executeCommand("outp build");
              }}
            />
            <TabButtonSpace />
            <TabButton
              iconName='inject'
              title={"Inject code into\nthe virtual machine"}
              clicked={async () => {
                const buildPane =
                  outputPaneService.getOutputPaneBuffer("build");
                await ideCommandsService.executeCommand("inject", buildPane);
                await ideCommandsService.executeCommand("outp build");
              }}
            />
            <TabButtonSpace />
            <TabButton
              iconName='play'
              title={"Inject code and start\nthe virtual machine"}
              clicked={async () => {
                const buildPane =
                  outputPaneService.getOutputPaneBuffer("build");
                await ideCommandsService.executeCommand("run", buildPane);
                await ideCommandsService.executeCommand("outp build");
              }}
            />
            <TabButtonSpace />
            <TabButton
              iconName='debug'
              title={"Inject code and start\ndebugging"}
              clicked={async () => {
                const buildPane =
                  outputPaneService.getOutputPaneBuffer("build");
                await ideCommandsService.executeCommand("debug", buildPane);
                await ideCommandsService.executeCommand("outp build");
              }}
            />
          </>
        )}
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
          clicked={() => {
            documentService.moveActiveToRight();
            setHeaderVersion(headerVersion + 1);
          }}
        />
        <TabButton
          iconName='close'
          useSpace={true}
          clicked={() => {
            documentService.closeAllDocuments();
            setHeaderVersion(headerVersion + 1);
          }}
        />
      </div>
    </div>
  ) : null;
};
