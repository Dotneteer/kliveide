import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type {
  PanelRenderContext,
  PanelRuntimeMetadata,
  PanelRuntimeValue
} from "../../src/components/ide/panel-runtime";
import { usePanelRuntime } from "../../src/components/ide/panel-runtime";
import type { PanelPlacement } from "../../../common/state/ide-panel-layout-state";

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

  const api = usePanelRuntime(metadata);

  const publishValue = useCallback(
    (runtime: PanelRenderContext, options?: { initial?: boolean }) => {
      const value: PanelRuntimeValue = {
        contributionId: runtime.contributionId,
        instanceId: runtime.instanceId,
        placement: runtime.placement,
        activityId: runtime.activityId,
        groupId: runtime.groupId,
        chrome: runtime.chrome,
        readonly: runtime.readonly,
        state: runtime.state,
        globalState: runtime.globalState
      };
      updateStateRef.current({ value }, options);
      return value;
    },
    []
  );

  useLayoutEffect(() => {
    publishValue(api, { initial: true });
  }, [api, publishValue]);

  useEffect(() => {
    registerComponentApi?.(api);
  }, [api, registerComponentApi]);

  return null;
}
