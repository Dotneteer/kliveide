import { useLayoutEffect, useMemo, useRef } from "react";
import { isEqual, throttle } from "lodash";
import { getRendererStore } from "../../store/rendererStore";
import {
  emuLoadedAction,
  emuSynchedAction,
  ideLoadedAction,
  isWindowsAction,
  emuFocusedAction,
  ideFocusedAction,
  setThemeAction,
  setOsAction,
  setAppPathAction,
  setGlobalSettingAction,
  toggleGlobalSettingAction,
} from "@state/actions";
import type { AppState } from "@state/AppState";

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
  
  // Helper function to update component state consistently
  const updateComponentState = () => {
    const currentState = store.getState();
    updateStateRef.current({ 
      value: currentState,
      globalSettings: currentState.globalSettings || {}
    });
  };
  
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
          updateComponentState();
        },
        emuSynched: () => {
          store.dispatch(emuSynchedAction());
          updateComponentState();
        },
        ideLoaded: () => {
          store.dispatch(ideLoadedAction());
          updateComponentState();
        },
        isWindows: (flag: boolean) => {
          store.dispatch(isWindowsAction(flag));
          updateComponentState();
        },
        emuFocused: (flag: boolean) => {
          store.dispatch(emuFocusedAction(flag));
          updateComponentState();
        },
        ideFocused: (flag: boolean) => {
          store.dispatch(ideFocusedAction(flag));
          updateComponentState();
        },
        setTheme: (id: string) => {
          store.dispatch(setThemeAction(id));
          updateComponentState();
        },
        setOs: (os: string) => {
          store.dispatch(setOsAction(os));
          updateComponentState();
        },
        setAppPath: (appPath: string) => {
          store.dispatch(setAppPathAction(appPath));
          updateComponentState();
        },
        setGlobalSetting: (id: string, value: any) => {
          store.dispatch(setGlobalSettingAction(id, value));
          updateComponentState();
        },
        toggleGlobalSetting: (id: string) => {
          store.dispatch(toggleGlobalSettingAction(id));
          updateComponentState();
        },
      });
    }

    // Subscribe to store changes
    const unsubscribe = store.subscribe(() => {
      const newState = store.getState();
      const prevState = prevStateRef.current;

      // Update the component state with new value and globalSettings
      updateComponentState();

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
    updateComponentState();

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
