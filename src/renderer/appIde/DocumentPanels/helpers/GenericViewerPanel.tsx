import styles from "./GenericViewerPanel.module.scss";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useEffect, useState } from "react";
import { Panel } from "@renderer/controls/layout/Panel";

// --- Generic file viewer panel state
type GenericViewerViewState = {
  scrollPosition?: number;
};

// --- Context to pass for concrete file panel renderers
type GenericViewerContext<TState extends GenericViewerViewState> = {
  changeViewState: (setter: (vs: TState) => void) => void;
  version: number;
  contextData?: any;
  update: (data?: any) => void;
};

/*
 * Renderers are render functions, not components.
 *
 * They were passed to `createElement`, which makes React treat them as component *types*. The one
 * consumer defines them inline, so the type changed on every parent render and React remounted the
 * whole body each time — discarding the virtualizer handle and re-running its async scroll restore.
 * Calling them inlines their output here instead. A renderer that needs hooks should return an
 * element of a module-scope component, as `StaticMemoryDump` now does.
 */
type GenericViewerProps<TState extends GenericViewerViewState> =
  DocumentProps<TState> & {
    saveScrollTop?: boolean;
    headerRenderer?: (context: GenericViewerContext<TState>) => JSX.Element;
    renderer?: (context: GenericViewerContext<TState>) => JSX.Element;
  };

// --- Generic file viewer panel renderer function
export function GenericViewerPanel<TState extends GenericViewerViewState> ({
  document,
  saveScrollTop = true,
  viewState,
  headerRenderer,
  renderer
}: GenericViewerProps<TState>) {
  // --- Version to update the view
  const [version, setVersion] = useState<number>(1);
  const [contextData, setContextData] = useState<any>(undefined);

  // --- Initial view state
  const [currentViewState, setCurrentViewState] = useState<TState>(viewState);
  const documentHubService = useDocumentHubService();

  // --- Save the view state whenever it changes
  useEffect(() => {
    if (document?.id && currentViewState) {
      documentHubService.setDocumentViewState(document.id, currentViewState);
    }
  }, [currentViewState, document?.id, documentHubService]);

  // --- Create the context to pass
  const context: GenericViewerContext<TState> = {
    changeViewState: (setter: (vs: TState) => void) => {
      const newViewState = { ...currentViewState };
      setter(newViewState);
      setCurrentViewState(newViewState);
    },
    version,
    contextData,
    update: (data?: any) => {
      setVersion(version + 1);
      if (data) {
        setContextData(data);
      }
    }
  };

  // --- Render the view
  return (
    <Panel xclass={styles.panelFont}>
      {headerRenderer?.(context)}
      <Panel
        initialScrollPosition={currentViewState?.scrollPosition}
        onScrolled={pos => {
          if (saveScrollTop) {
            context.changeViewState(vs => (vs.scrollPosition = pos));
          }
        }}
      >
        {renderer?.(context)}
      </Panel>
    </Panel>
  );
}
