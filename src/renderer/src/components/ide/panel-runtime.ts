import { createContext, useContext, useMemo } from "react";
import type { IdePanelLayoutState, PanelPlacement } from "../../../../common/state/ide-panel-layout-state";
import {
  createDefaultIdePanelLayoutState
} from "../../../../common/state/ide-panel-layout-state";
import {
  patchPanelViewStateAction,
  setPanelContributionStateAction,
  setPanelInstanceStateAction
} from "../../../../common/state/actions";
import type { Action } from "../../../../common/state/Action";
import { useDispatch, useSharedState } from "../../../shared-store";

export type PanelChrome = "sideBar" | "document" | "tool" | "compact";

export type PanelRuntimeMetadata = {
  contributionId: string;
  instanceId: string;
  placement: PanelPlacement;
  activityId?: string;
  groupId?: string;
  chrome?: PanelChrome;
  readonly?: boolean;
};

export type PanelRuntimeValue = PanelRuntimeMetadata & {
  state: Record<string, unknown>;
  globalState: Record<string, unknown>;
};

export type PanelRenderContext = PanelRuntimeValue & {
  getState: <T = unknown>(key: string, defaultValue?: T) => T;
  setState: (key: string, value: unknown) => PanelRuntimeValue;
  patchState: (patch: Record<string, unknown>) => PanelRuntimeValue;
  getGlobalState: <T = unknown>(key: string, defaultValue?: T) => T;
  setGlobalState: (key: string, value: unknown) => PanelRuntimeValue;
};

export const PanelRuntimeReactContext = createContext<PanelRenderContext | null>(null);

export function usePanelRuntime(metadata?: PanelRuntimeMetadata): PanelRenderContext {
  const context = useContext(PanelRuntimeReactContext);
  const resolvedMetadata = context ?? metadata;
  const sharedState = useSharedState();
  const dispatch = useDispatch();
  const layout = sharedState.idePanelLayout ?? createDefaultIdePanelLayoutState();

  return useMemo(() => {
    if (context) {
      return context;
    }
    if (!resolvedMetadata) {
      throw new Error("Panel runtime is missing");
    }
    return createPanelRenderContext(resolvedMetadata, layout, dispatch);
  }, [
    context,
    dispatch,
    layout,
    resolvedMetadata?.activityId,
    resolvedMetadata?.chrome,
    resolvedMetadata?.contributionId,
    resolvedMetadata?.groupId,
    resolvedMetadata?.instanceId,
    resolvedMetadata?.placement,
    resolvedMetadata?.readonly
  ]);
}

export function createPanelRenderContext(
  metadata: PanelRuntimeMetadata,
  layout: IdePanelLayoutState,
  dispatch: (action: Action) => unknown
): PanelRenderContext {
  const value = getPanelRuntimeValue(metadata, layout);
  return {
    ...value,
    getState<T = unknown>(key: string, defaultValue?: T): T {
      return readPanelState(layout, value.instanceId, key, defaultValue);
    },
    setState(key: string, nextValue: unknown): PanelRuntimeValue {
      dispatch(setPanelInstanceStateAction(value.instanceId, key, nextValue));
      return {
        ...value,
        state: {
          ...value.state,
          [key]: nextValue
        }
      };
    },
    patchState(patch: Record<string, unknown>): PanelRuntimeValue {
      dispatch(patchPanelViewStateAction(value.instanceId, patch));
      return {
        ...value,
        state: {
          ...value.state,
          ...patch
        }
      };
    },
    getGlobalState<T = unknown>(key: string, defaultValue?: T): T {
      return readPanelGlobalState(layout, value.contributionId, key, defaultValue);
    },
    setGlobalState(key: string, nextValue: unknown): PanelRuntimeValue {
      dispatch(setPanelContributionStateAction(value.contributionId, key, nextValue));
      return {
        ...value,
        globalState: {
          ...value.globalState,
          [key]: nextValue
        }
      };
    }
  };
}

export function getPanelRuntimeValue(
  metadata: PanelRuntimeMetadata,
  layout: IdePanelLayoutState
): PanelRuntimeValue {
  return {
    ...metadata,
    chrome: metadata.chrome ?? "sideBar",
    state: layout.viewStateByInstance[metadata.instanceId] ?? {},
    globalState: layout.contributionState[metadata.contributionId] ?? {}
  };
}

export function readPanelState<T = unknown>(
  layout: IdePanelLayoutState,
  instanceId: string,
  key: string,
  defaultValue?: T
): T {
  const value = layout.viewStateByInstance[instanceId]?.[key];
  return (value === undefined ? defaultValue : value) as T;
}

export function readPanelGlobalState<T = unknown>(
  layout: IdePanelLayoutState,
  contributionId: string,
  key: string,
  defaultValue?: T
): T {
  const value = layout.contributionState[contributionId]?.[key];
  return (value === undefined ? defaultValue : value) as T;
}
