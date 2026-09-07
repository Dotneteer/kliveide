import styles from "./GenericViewerPanel.module.scss";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel } from "@renderer/controls/layout/Panel";
import { AppServices } from "@renderer/abstractions/AppServices";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

/**
 * The one panel behind every file viewer and file editor.
 *
 * `GenericFileViewerPanel` and `GenericFileEditorPanel` were the same component twice: identical
 * state, identical loader effect, identical view-state effect and a render body that matched
 * line for line. The editor's only additions were `saveToFile` and `viewState` on its context, so
 * the two collapse by giving every panel both — a viewer simply never calls `saveToFile`.
 */

type GenericFileViewState = {
  scrollPosition?: number;
};

export type GenericFileContext<TFile, TState extends GenericFileViewState> = {
  fileInfo?: TFile;
  fileError?: string;
  valid: boolean;
  initialized: boolean;
  appServices: AppServices;
  viewState: TState;
  changeViewState: (setter: (vs: TState) => void) => void;
  saveToFile: (contents: Uint8Array) => Promise<void>;
};

/**
 * A renderer is a **render function**, not a component.
 *
 * It used to be handed to `createElement`, which makes React treat it as a component *type*. Every
 * consumer defines its renderer inline, so that type changed identity on each parent render and
 * React unmounted and remounted the whole file view every time — `StaticMemoryDump`'s renderer,
 * which holds a `useRef` and an async initialisation, was re-running its setup on every render of
 * its parent for exactly this reason.
 *
 * Calling the function inlines its output into this component's tree instead, so identity stops
 * mattering. The cost is that a renderer may not call hooks: if it needs state, it should return an
 * element of a real component (`ctx => <MyBody ctx={ctx} />`), which is stable because the
 * component is declared at module scope.
 */
type FileRenderer<TFile, TState extends GenericFileViewState> = (
  context: GenericFileContext<TFile, TState>
) => JSX.Element;

type GenericFilePanelProps<TFile, TState extends GenericFileViewState> = DocumentProps<TState> & {
  fileLoader: (contents: Uint8Array) => { fileInfo?: TFile; error?: string };
  invalidRenderer?: FileRenderer<TFile, TState>;
  validRenderer?: FileRenderer<TFile, TState>;
};

export function GenericFilePanel<TFile, TState extends GenericFileViewState>({
  document,
  contents,
  viewState,
  fileLoader,
  invalidRenderer,
  validRenderer
}: GenericFilePanelProps<TFile, TState>) {
  const [currentViewState, setCurrentViewState] = useState<TState>(viewState);
  const documentHubService = useDocumentHubService();
  const appServices = useAppServices();

  const [fileInfo, setFileInfo] = useState<TFile>();
  const [fileError, setFileError] = useState<string>();
  const [initialized, setInitialized] = useState(false);
  const [valid, setValid] = useState(true);

  // Reload when the document *or its bytes* change. `contents` was missing from the dependencies,
  // so a file re-read that produced new bytes under the same document showed the old parse.
  useEffect(() => {
    try {
      const result = fileLoader(contents);
      setFileInfo(result.fileInfo);
      setValid(!result.error);
      if (result.error) setFileError(result.error);
    } catch (err) {
      setFileError(err.message);
      setValid(false);
    } finally {
      setInitialized(true);
    }
  }, [document, contents, fileLoader]);

  useEffect(() => {
    if (document.id) {
      documentHubService.setDocumentViewState(document.id, currentViewState);
    }
  }, [currentViewState, document.id, documentHubService]);

  const changeViewState = useCallback((setter: (vs: TState) => void) => {
    setCurrentViewState((prev) => {
      const next = { ...prev };
      setter(next);
      return next;
    });
  }, []);

  const saveToFile = useCallback(
    async (data: Uint8Array) => {
      await appServices.projectService.saveFileContent(document.id, data);
    },
    [appServices.projectService, document.id]
  );

  /*
   * The context is built during render, not stored in state.
   *
   * Both predecessors kept it in a `useState` written from an effect, which meant every view-state
   * change cost two renders and the context lagged one render behind the values it described.
   */
  const context = useMemo<GenericFileContext<TFile, TState>>(
    () => ({
      fileInfo,
      fileError,
      valid,
      initialized,
      appServices,
      viewState: currentViewState,
      changeViewState,
      saveToFile
    }),
    [
      fileInfo,
      fileError,
      valid,
      initialized,
      appServices,
      currentViewState,
      changeViewState,
      saveToFile
    ]
  );

  if (!initialized) return null;

  return (
    <Panel
      xclass={styles.panelFont}
      initialScrollPosition={currentViewState?.scrollPosition}
      onScrolled={(pos) => changeViewState((vs) => (vs.scrollPosition = pos))}
    >
      {!valid && (
        <div className={styles.invalid}>
          {invalidRenderer ? invalidRenderer(context) : <>File content is not a valid: {fileError}</>}
        </div>
      )}
      {valid && validRenderer?.(context)}
    </Panel>
  );
}
