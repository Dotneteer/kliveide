import { useLayoutEffect, useMemo, useRef } from "react";
import { isEqual, throttle } from "lodash";
import { getRendererStore } from "../store/rendererStore";
import {
  emuLoadedAction,
  emuSynchedAction,
  ideLoadedAction,
  isWindowsAction,
  emuFocusedAction,
  ideFocusedAction,
  setThemeAction,
} from "../../../../common/state/actions";
import type { AppState } from "../../../../common/state/AppState";

// =====================================================================================================================
// React SharedAppState component implementation

type Props = {
  throttleWaitInMs?: number;
  onChange?: (event: { prevValue: AppState; newValue: AppState }) => void;
  registerComponentApi: any;
  updateState: any;
};

export const defaultProps: Pick<Props, "throttleWaitInMs"> = {
  throttleWaitInMs: 0,
};

export function SharedAppStateNative({
  throttleWaitInMs = defaultProps.throttleWaitInMs,
  onChange,
  registerComponentApi,
  updateState,
}: Props) {
  const store = getRendererStore();
  const prevStateRef = useRef<AppState>(store.getState());
  
  // Use refs to store stable references to prop functions
  const updateStateRef = useRef(updateState);
  const onChangeRef = useRef(onChange);
  const registerComponentApiRef = useRef(registerComponentApi);
  
  // Update refs when props change
  updateStateRef.current = updateState;
  onChangeRef.current = onChange;
  registerComponentApiRef.current = registerComponentApi;

  // Create throttled onChange handler
  const throttledOnChange = useMemo(() => {
    if (throttleWaitInMs !== 0 && onChange) {
      return throttle(onChange, throttleWaitInMs, {
        leading: true,
      });
    }
    return onChange;
  }, [onChange, throttleWaitInMs]);

  // Register API and subscribe to store changes using useLayoutEffect
  // This ensures the subscription is ready BEFORE onReady fires
  useLayoutEffect(() => {
    // Register API methods
    if (registerComponentApiRef.current) {
      registerComponentApiRef.current({
        emuLoaded: () => {
          store.dispatch(emuLoadedAction());
          // Immediately update component state after dispatch
          updateStateRef.current({ value: store.getState() });
        },
        emuSynched: () => {
          store.dispatch(emuSynchedAction());
          updateStateRef.current({ value: store.getState() });
        },
        ideLoaded: () => {
          store.dispatch(ideLoadedAction());
          updateStateRef.current({ value: store.getState() });
        },
        isWindows: (flag: boolean) => {
          store.dispatch(isWindowsAction(flag));
          updateStateRef.current({ value: store.getState() });
        },
        emuFocused: (flag: boolean) => {
          store.dispatch(emuFocusedAction(flag));
          updateStateRef.current({ value: store.getState() });
        },
        ideFocused: (flag: boolean) => {
          store.dispatch(ideFocusedAction(flag));
          updateStateRef.current({ value: store.getState() });
        },
        setTheme: (id: string) => {
          store.dispatch(setThemeAction(id));
          updateStateRef.current({ value: store.getState() });
        },
      });
    }

    // Subscribe to store changes
    const unsubscribe = store.subscribe(() => {
      const newState = store.getState();
      const prevState = prevStateRef.current;

      // Update the component state with new value
      updateStateRef.current({ value: newState });

      // Fire onChange event if state actually changed
      if (throttledOnChange && !isEqual(prevState, newState)) {
        throttledOnChange({
          prevValue: prevState,
          newValue: newState,
        });
      }

      // Update ref for next comparison
      prevStateRef.current = newState;
    });

    // Initial state update
    updateStateRef.current({ value: store.getState() });

    return () => {
      unsubscribe();
      // Cleanup throttled function
      if (throttledOnChange && throttledOnChange !== onChangeRef.current) {
        (throttledOnChange as any).cancel?.();
      }
    };
  }, [store, throttledOnChange]);

  return null;
}
