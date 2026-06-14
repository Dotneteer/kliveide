import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PanelPlacement } from "./panel-registry";

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

type Listener = () => void;

const instanceStateById = new Map<string, Record<string, unknown>>();
const contributionStateById = new Map<string, Record<string, unknown>>();
const listenersByKey = new Map<string, Set<Listener>>();
let version = 0;

export const PanelRuntimeReactContext = createContext<PanelRenderContext | null>(null);

export function usePanelRuntime(metadata?: PanelRuntimeMetadata): PanelRenderContext {
  const context = useContext(PanelRuntimeReactContext);
  const resolvedMetadata = context ?? metadata;
  const [runtimeVersion, setRuntimeVersion] = useState(() => getPanelRuntimeVersion());

  useEffect(() => {
    if (!resolvedMetadata) {
      return;
    }

    return subscribePanelRuntime(resolvedMetadata, () => {
      setRuntimeVersion(getPanelRuntimeVersion());
    });
  }, [
    resolvedMetadata?.contributionId,
    resolvedMetadata?.instanceId,
    resolvedMetadata?.placement,
    resolvedMetadata?.activityId,
    resolvedMetadata?.groupId,
    resolvedMetadata?.chrome,
    resolvedMetadata?.readonly
  ]);

  return useMemo(() => {
    if (context) {
      return context;
    }
    if (!metadata) {
      throw new Error("Panel runtime is missing");
    }
    return createPanelRenderContext(metadata);
  }, [
    context,
    metadata?.contributionId,
    metadata?.instanceId,
    metadata?.placement,
    metadata?.activityId,
    metadata?.groupId,
    metadata?.chrome,
    metadata?.readonly,
    runtimeVersion
  ]);
}

export function createPanelRenderContext(metadata: PanelRuntimeMetadata): PanelRenderContext {
  const value = getPanelRuntimeValue(metadata);
  return {
    ...value,
    getState<T = unknown>(key: string, defaultValue?: T): T {
      return readPanelState(value.instanceId, key, defaultValue);
    },
    setState(key: string, nextValue: unknown): PanelRuntimeValue {
      return setPanelState(metadata, key, nextValue);
    },
    patchState(patch: Record<string, unknown>): PanelRuntimeValue {
      return patchPanelState(metadata, patch);
    },
    getGlobalState<T = unknown>(key: string, defaultValue?: T): T {
      return readPanelGlobalState(value.contributionId, key, defaultValue);
    },
    setGlobalState(key: string, nextValue: unknown): PanelRuntimeValue {
      return setPanelGlobalState(metadata, key, nextValue);
    }
  };
}

export function getPanelRuntimeValue(metadata: PanelRuntimeMetadata): PanelRuntimeValue {
  return {
    ...metadata,
    chrome: metadata.chrome ?? "sideBar",
    state: getInstanceState(metadata.instanceId),
    globalState: getContributionState(metadata.contributionId)
  };
}

export function readPanelState<T = unknown>(
  instanceId: string,
  key: string,
  defaultValue?: T
): T {
  const state = instanceStateById.get(instanceId);
  const value = state?.[key];
  return (value === undefined ? defaultValue : value) as T;
}

export function setPanelState(
  metadata: PanelRuntimeMetadata,
  key: string,
  nextValue: unknown
): PanelRuntimeValue {
  const current = getInstanceState(metadata.instanceId);
  instanceStateById.set(metadata.instanceId, { ...current, [key]: nextValue });
  notifyPanelRuntimeChanged(metadata);
  return getPanelRuntimeValue(metadata);
}

export function patchPanelState(
  metadata: PanelRuntimeMetadata,
  patch: Record<string, unknown>
): PanelRuntimeValue {
  const current = getInstanceState(metadata.instanceId);
  instanceStateById.set(metadata.instanceId, { ...current, ...patch });
  notifyPanelRuntimeChanged(metadata);
  return getPanelRuntimeValue(metadata);
}

export function readPanelGlobalState<T = unknown>(
  contributionId: string,
  key: string,
  defaultValue?: T
): T {
  const state = contributionStateById.get(contributionId);
  const value = state?.[key];
  return (value === undefined ? defaultValue : value) as T;
}

export function setPanelGlobalState(
  metadata: PanelRuntimeMetadata,
  key: string,
  nextValue: unknown
): PanelRuntimeValue {
  const current = getContributionState(metadata.contributionId);
  contributionStateById.set(metadata.contributionId, { ...current, [key]: nextValue });
  notifyPanelRuntimeChanged(metadata);
  return getPanelRuntimeValue(metadata);
}

export function subscribePanelRuntime(
  metadata: Pick<PanelRuntimeMetadata, "instanceId" | "contributionId">,
  listener: Listener
): () => void {
  const keys = [instanceListenerKey(metadata.instanceId), contributionListenerKey(metadata.contributionId)];
  for (const key of keys) {
    const listeners = listenersByKey.get(key) ?? new Set<Listener>();
    listeners.add(listener);
    listenersByKey.set(key, listeners);
  }

  return () => {
    for (const key of keys) {
      const listeners = listenersByKey.get(key);
      listeners?.delete(listener);
      if (listeners?.size === 0) {
        listenersByKey.delete(key);
      }
    }
  };
}

export function getPanelRuntimeVersion(): number {
  return version;
}

export function resetPanelRuntimeState(): void {
  instanceStateById.clear();
  contributionStateById.clear();
  listenersByKey.clear();
  version++;
}

function getInstanceState(instanceId: string): Record<string, unknown> {
  return instanceStateById.get(instanceId) ?? {};
}

function getContributionState(contributionId: string): Record<string, unknown> {
  return contributionStateById.get(contributionId) ?? {};
}

function notifyPanelRuntimeChanged(metadata: Pick<PanelRuntimeMetadata, "instanceId" | "contributionId">): void {
  version++;
  const listeners = new Set<Listener>([
    ...(listenersByKey.get(instanceListenerKey(metadata.instanceId)) ?? []),
    ...(listenersByKey.get(contributionListenerKey(metadata.contributionId)) ?? [])
  ]);
  listeners.forEach((listener) => listener());
}

function instanceListenerKey(instanceId: string): string {
  return `instance:${instanceId}`;
}

function contributionListenerKey(contributionId: string): string {
  return `contribution:${contributionId}`;
}
