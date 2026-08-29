import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { useEffect } from "react";

export type BasicViewState = {
  topIndex?: number;
  autoRefresh?: boolean;
  showCodes?: boolean;
  showSpectrumFont?: boolean;
};

type BasicViewStateValues = Required<BasicViewState>;

type PersistenceParams = BasicViewStateValues & {
  dispatch: (action: unknown) => void;
  documentHubService: Pick<IDocumentHubService, "setDocumentViewState">;
  documentId?: string;
  incProjectFileVersion: () => unknown;
  mainApi: {
    saveProject: () => Promise<unknown>;
  };
};

export function buildBasicViewState(values: BasicViewStateValues): BasicViewState {
  return {
    topIndex: values.topIndex,
    autoRefresh: values.autoRefresh,
    showCodes: values.showCodes,
    showSpectrumFont: values.showSpectrumFont
  };
}

export function useBasicViewStatePersistence({
  autoRefresh,
  dispatch,
  documentHubService,
  documentId,
  incProjectFileVersion,
  mainApi,
  showCodes,
  showSpectrumFont,
  topIndex
}: PersistenceParams): void {
  useEffect(() => {
    if (!documentId) return;

    documentHubService.setDocumentViewState(
      documentId,
      buildBasicViewState({ autoRefresh, showCodes, showSpectrumFont, topIndex })
    );
    void (async () => {
      await mainApi.saveProject();
      dispatch(incProjectFileVersion());
    })();
  }, [
    dispatch,
    documentHubService,
    documentId,
    incProjectFileVersion,
    mainApi,
    autoRefresh,
    showCodes,
    showSpectrumFont,
    topIndex
  ]);
}
