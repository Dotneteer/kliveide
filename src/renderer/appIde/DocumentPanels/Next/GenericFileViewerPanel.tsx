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
type GenericFileViewerContext<TFile, TState extends GenericFileViewerViewState> = {
  fileInfo?: TFile;
  fileError?: string;
  valid: boolean;
  initialized: boolean;
  currentViewState: TState;
  changeViewState: (setter: (vs: TState) => void) => void;
};

// --- Properties of a generic file panel renderer
type GenericFileViewerProps<TFile, TState extends GenericFileViewerViewState> =
  DocumentProps<TState> & {
    fileLoader: (
      contents: Uint8Array,
    ) => {fileInfo?: TFile, error?: string};
    invalidRenderer?: (context: GenericFileViewerContext<TFile, TState>) => JSX.Element;
    validRenderer?: (context: GenericFileViewerContext<TFile, TState>) => JSX.Element;
  };

// --- Generic file viewer panel renderer function
export function GenericFileViewerPanel<TFile, TState extends GenericFileViewerViewState> ({
  document,
  contents,
  viewState,
  fileLoader,
  invalidRenderer,
  validRenderer
}: GenericFileViewerProps<TFile, TState>) {
  // --- Initial view state
  const [currentViewState, setCurrentViewState] = useState<TState>(viewState);
  const documentHubService = useDocumentHubService();

  const [fileInfo, setFileInfo] = useState<TFile>();
  const [fileError, setFileError] = useState<string>();
  const [initialized, setInitialized] = useState<boolean>(false);
  const [valid, setValid] = useState<boolean>(true);

  // --- Obtain the document file whenever it changes
  useEffect(() => {
    try {
      const result = fileLoader(contents);
      setFileInfo(result.fileInfo);
      setValid(!result.error);
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
  const context: GenericFileViewerContext<TFile, TState> = {
    fileInfo,
    fileError,
    valid,
    initialized,
    currentViewState,
    changeViewState: (setter: (vs: TState) => void) => {
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
      onScrolled={pos =>
        context.changeViewState(vs => (vs.scrollPosition = pos))
      }
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
