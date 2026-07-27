import { DISASSEMBLY_EDITOR } from "@common/state/common-ids";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef } from "react";

export type CachedRefreshState = {
  isFullView: boolean;
  autoRefresh: boolean;
  screen: boolean;
  ram: boolean;
  currentSegment: number;
  decimalView: boolean;
};

export type BankedDisassemblyPanelViewState = {
  topAddress?: number;
  isFullView?: boolean;
  autoRefresh?: boolean;
  currentSegment?: number;
  decimalView?: boolean;
  ram?: boolean;
  screen?: boolean;
  disassOffset?: number;
  bankLabel?: boolean;
};

export type DisassemblyViewStateValues = {
  topAddress: number;
  isFullView: boolean;
  autoRefresh: boolean;
  currentSegment: number;
  decimalView: boolean;
  ram: boolean;
  screen: boolean;
  disassOffset: number;
  bankLabel: boolean;
};

type PersistenceParams = DisassemblyViewStateValues & {
  cachedRefreshState: MutableRefObject<CachedRefreshState>;
  dispatch: (action: unknown) => void;
  documentHubService: Pick<IDocumentHubService, "saveActiveDocumentState">;
  incProjectFileVersion: () => unknown;
  mainApi: {
    saveProject: () => Promise<unknown>;
  };
  setWorkspaceSettings: (id: string, value: unknown) => unknown;
};

export function loadDisassemblyPanelViewState(
  documentHubService: Pick<IDocumentHubService, "getDocumentViewState">,
  document: ProjectDocumentState
): BankedDisassemblyPanelViewState | undefined {
  return document?.id
    ? (documentHubService.getDocumentViewState(document.id) as BankedDisassemblyPanelViewState)
    : undefined;
}

export function buildDisassemblyPanelViewState(
  values: DisassemblyViewStateValues
): BankedDisassemblyPanelViewState {
  return {
    topAddress: values.topAddress,
    isFullView: values.isFullView,
    currentSegment: values.currentSegment,
    decimalView: values.decimalView,
    bankLabel: values.bankLabel,
    autoRefresh: values.autoRefresh,
    ram: values.ram,
    screen: values.screen,
    disassOffset: values.disassOffset
  };
}

export function useLoadedDisassemblyViewState(
  documentHubService: Pick<IDocumentHubService, "getDocumentViewState">,
  document: ProjectDocumentState
): BankedDisassemblyPanelViewState | undefined {
  return useMemo(() => loadDisassemblyPanelViewState(documentHubService, document), []);
}

export function useDisassemblyViewStatePersistence({
  cachedRefreshState,
  dispatch,
  documentHubService,
  incProjectFileVersion,
  mainApi,
  setWorkspaceSettings,
  ...values
}: PersistenceParams): void {
  const isInitialMount = useRef(true);
  const saveViewStateTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    cachedRefreshState.current = {
      isFullView: values.isFullView,
      autoRefresh: values.autoRefresh,
      currentSegment: values.currentSegment,
      decimalView: values.decimalView,
      screen: values.screen,
      ram: values.ram
    };
  }, [
    cachedRefreshState,
    values.isFullView,
    values.autoRefresh,
    values.currentSegment,
    values.decimalView,
    values.screen,
    values.ram
  ]);

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

    const mergedState = buildDisassemblyPanelViewState(values);
    if (saveViewStateTimeout.current) {
      clearTimeout(saveViewStateTimeout.current);
    }

    saveViewStateTimeout.current = setTimeout(async () => {
      documentHubService.saveActiveDocumentState(mergedState);
      dispatch(setWorkspaceSettings(DISASSEMBLY_EDITOR, mergedState));
      await mainApi.saveProject();
      dispatch(incProjectFileVersion());
    }, 100);
  }, [
    dispatch,
    documentHubService,
    incProjectFileVersion,
    mainApi,
    setWorkspaceSettings,
    values.topAddress,
    values.isFullView,
    values.autoRefresh,
    values.currentSegment,
    values.decimalView,
    values.ram,
    values.screen,
    values.disassOffset,
    values.bankLabel
  ]);
}
