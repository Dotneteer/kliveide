import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type {
  PanelRenderContext,
  PanelRuntimeMetadata,
  PanelRuntimeValue
} from "../../src/components/ide/panel-runtime";
import {
  createPanelRenderContext,
  getPanelRuntimeValue,
  subscribePanelRuntime
} from "../../src/components/ide/panel-runtime";
import type { PanelPlacement } from "../../src/components/ide/panel-registry";

export type PanelRuntimeReactProps = PanelRuntimeMetadata & {
  registerComponentApi?: (api: PanelRenderContext) => void;
  updateState?: (componentState: { value: PanelRuntimeValue }, options?: { initial?: boolean }) => void;
};

const noopUpdateState = () => {};

export function PanelRuntimeReact({
  contributionId,
  instanceId,
  placement,
  activityId,
  groupId,
  chrome = "sideBar",
  readonly = false,
  registerComponentApi,
  updateState = noopUpdateState
}: PanelRuntimeReactProps) {
  const updateStateRef = useRef(updateState);

  useEffect(() => {
    updateStateRef.current = updateState;
  }, [updateState]);

  const metadata = useMemo<PanelRuntimeMetadata>(
    () => ({
      contributionId,
      instanceId,
      placement: placement as PanelPlacement,
      activityId,
      groupId,
      chrome,
      readonly
    }),
    [activityId, chrome, contributionId, groupId, instanceId, placement, readonly]
  );

  const publishValue = useCallback(
    (options?: { initial?: boolean }) => {
      const value = getPanelRuntimeValue(metadata);
      updateStateRef.current({ value }, options);
      return value;
    },
    [metadata]
  );

  const api = useMemo<PanelRenderContext>(() => {
    const context = createPanelRenderContext(metadata);
    return {
      ...context,
      setState(key: string, nextValue: unknown) {
        const value = context.setState(key, nextValue);
        publishValue();
        return value;
      },
      patchState(patch: Record<string, unknown>) {
        const value = context.patchState(patch);
        publishValue();
        return value;
      },
      setGlobalState(key: string, nextValue: unknown) {
        const value = context.setGlobalState(key, nextValue);
        publishValue();
        return value;
      }
    };
  }, [metadata, publishValue]);

  useLayoutEffect(() => {
    publishValue({ initial: true });
  }, [publishValue]);

  useEffect(() => {
    registerComponentApi?.(api);
  }, [api, registerComponentApi]);

  useEffect(() => subscribePanelRuntime(metadata, () => publishValue()), [metadata, publishValue]);

  return null;
}
