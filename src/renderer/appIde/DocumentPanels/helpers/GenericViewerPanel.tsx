import styles from "./GenericViewerPanel.module.scss";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import { createElement, useEffect, useState } from "react";
import { Panel } from "@renderer/controls/generic/Panel";

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

// --- Properties of a generic file panel renderer
type GenericViewerProps<TState extends GenericViewerViewState> =
  DocumentProps<TState> & {
    saveScrollTop?: boolean;
    headerRenderer?: (context: GenericViewerContext<TState>) => JSX.Element;
    renderer?: (context: GenericViewerContext<TState>) => JSX.Element;
  };

// --- Generic file viewer panel renderer function
export function GenericViewerPanel<TState extends GenericViewerViewState> ({
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
    if (currentViewState) {
      documentHubService.saveActiveDocumentState(currentViewState);
    }
  }, [currentViewState]);

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
      {headerRenderer && createElement(headerRenderer, context)}
      <Panel
        initialScrollPosition={currentViewState?.scrollPosition}
        onScrolled={pos => {
          if (saveScrollTop) {
            context.changeViewState(vs => (vs.scrollPosition = pos));
          }
        }}
      >
        {createElement(renderer, context)}
      </Panel>
    </Panel>
  );
}
