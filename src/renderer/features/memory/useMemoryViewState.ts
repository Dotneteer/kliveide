import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  BankedMemoryPanelViewState,
  CachedRefreshState,
  DumpViewMode
} from "./memoryViewModel";

export type MemoryViewStateValues = {
  topIndex: number;
  isFullView: boolean;
  currentSegment: number;
  decimalView: boolean;
  viewMode: DumpViewMode;
  charDump: boolean;
  bankLabel: boolean;
};

type PersistenceParams = MemoryViewStateValues & {
  cachedRefreshState: MutableRefObject<CachedRefreshState>;
  documentId: string;
  dispatch: (action: unknown) => void;
  documentHubService: Pick<IDocumentHubService, "setDocumentViewState">;
  incProjectFileVersion: () => unknown;
  isInitializing: boolean;
  mainApi: {
    saveProject: () => Promise<unknown>;
  };
};

export function loadMemoryPanelViewState(
  documentHubService: Pick<IDocumentHubService, "getActiveDocument" | "getDocumentViewState">,
  document?: ProjectDocumentState
): BankedMemoryPanelViewState | undefined {
  const documentId = document?.id ?? documentHubService.getActiveDocument()?.id;
  return documentId
    ? (documentHubService.getDocumentViewState(documentId) as BankedMemoryPanelViewState)
    : undefined;
}

export function buildMemoryPanelViewState(
  values: MemoryViewStateValues
): BankedMemoryPanelViewState {
  return {
    topIndex: values.topIndex,
    isFullView: values.isFullView,
    currentSegment: values.currentSegment,
    decimalView: values.decimalView,
    viewMode: values.viewMode,
    charDump: values.charDump,
    bankLabel: values.bankLabel
  };
}

export function useLoadedMemoryViewState(
  documentHubService: Pick<IDocumentHubService, "getActiveDocument" | "getDocumentViewState">,
  document?: ProjectDocumentState
): BankedMemoryPanelViewState | undefined {
  return useMemo(
    () => loadMemoryPanelViewState(documentHubService, document),
    []
  );
}

export function useMemoryViewStatePersistence({
  cachedRefreshState,
  documentId,
  dispatch,
  documentHubService,
  incProjectFileVersion,
  isInitializing,
  mainApi,
  ...values
}: PersistenceParams): void {
  const isInitialMount = useRef(true);
  const saveViewStateTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    cachedRefreshState.current = {
      isFullView: values.isFullView,
      decimalView: values.decimalView,
      currentSegment: values.currentSegment
    };
  }, [cachedRefreshState, values.isFullView, values.decimalView, values.currentSegment]);

  useEffect(() => {
    return () => {
      if (saveViewStateTimeout.current) {
        clearTimeout(saveViewStateTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isInitializing) {
      return;
    }

    const mergedState = buildMemoryPanelViewState(values);
    if (saveViewStateTimeout.current) {
      clearTimeout(saveViewStateTimeout.current);
    }
    saveViewStateTimeout.current = setTimeout(async () => {
      documentHubService.setDocumentViewState(documentId, mergedState);
      await mainApi.saveProject();
      dispatch(incProjectFileVersion());
    }, 100);
  }, [
    dispatch,
    documentId,
    documentHubService,
    incProjectFileVersion,
    isInitializing,
    mainApi,
    values.topIndex,
    values.isFullView,
    values.currentSegment,
    values.decimalView,
    values.viewMode,
    values.charDump,
    values.bankLabel
  ]);
}
