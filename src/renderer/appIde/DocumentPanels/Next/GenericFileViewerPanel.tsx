import styles from "./GenericFileViewerPanel.module.scss";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import { useEffect, useState } from "react";
import { Panel } from "@renderer/controls/GeneralControls";

// --- Generic file viewer panel state
type GenericFileViewerViewState = {
  scrollPosition?: number;
};

// --- Context to pass for concrete file panel renderers
type GenericFileViewerContext<T extends GenericFileViewerViewState> = {
  fileInfo?: T;
  fileError?: string;
  valid: boolean;
  initialized: boolean;
  currentViewState: T;
  changeViewState: (setter: (vs: T) => void) => void;
};

// --- Properties of a generic file panel renderer
type GenericFileViewerProps<T extends GenericFileViewerViewState> =
  DocumentProps<T> & {
    context: GenericFileViewerContext<T>;
    fileLoader: (contents: Uint8Array) => T;
    invalidRenderer?: (context: GenericFileViewerContext<T>) => JSX.Element;
    validRenderer: (context: GenericFileViewerContext<T>) => JSX.Element;
  };

// --- Generic file viewer panel renderer function
export function GenericFileViewerPanel<T extends GenericFileViewerViewState> ({
  document,
  contents,
  viewState,
  fileLoader,
  invalidRenderer,
  validRenderer
}: GenericFileViewerProps<T>) {
  // --- Initial view state
  const [currentViewState, setCurrentViewState] = useState<T>(viewState);
  const documentHubService = useDocumentHubService();

  const [fileInfo, setFileInfo] = useState<T>();
  const [fileError, setFileError] = useState<string>();
  const [initialized, setInitialized] = useState<boolean>(false);
  const [valid, setValid] = useState<boolean>(true);

  // --- Obtain the document file whenever it changes
  useEffect(() => {
    try {
      const fileInfo = fileLoader(contents);
      setFileInfo(fileInfo);
      setValid(true);
    } catch (err) {
      setFileError(err.message);
      setValid(false);
    } finally {
      setInitialized(true);
    }
  }, [document]);

  // --- Save the view state whenever it changes
  useEffect(() => {
    if (currentViewState) {
      documentHubService.saveActiveDocumentState(currentViewState);
    }
  }, [currentViewState]);

  // --- Create the context to pass
  const context: GenericFileViewerContext<T> = {
    fileInfo,
    fileError,
    valid,
    initialized,
    currentViewState,
    changeViewState: (setter: (vs: T) => void) => {
      const newViewState = { ...currentViewState };
      setter(newViewState);
      setCurrentViewState(newViewState);
    }
  };

  // --- Render the view
  return initialized ? (
    <Panel
      xclass={styles.panelFont}
      initialScrollPosition={currentViewState?.scrollPosition}
      onScrolled={pos => context.changeViewState(vs => (vs.scrollPosition = pos))}
    >
      {!valid && (
        <div className={styles.invalid}>
          {invalidRenderer?.(context) ?? (
            <>File content is not a valid: {fileError}</>
          )}
        </div>
      )}
      {valid && validRenderer(context)}
    </Panel>
  ) : null;
}
