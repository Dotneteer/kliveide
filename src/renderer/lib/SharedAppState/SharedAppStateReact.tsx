import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Action } from "../../../common/state/Action";
import type { AppState } from "../../../common/state/AppState";
import {
  getSharedState,
  useReadAllSettingValues,
  useDispatch,
  useDispatchActivateActivity,
  useDispatchSelectActivity,
  useDispatchSetGlobalSetting,
  useDispatchSetTheme,
  useReadSettingValue,
  useSharedState,
  useUpdateSettingValue,
  windowKind
} from "../../shared-store";

type SharedAppStateReactProps = {
  fireDidChangeOnInit?: boolean;
  onDidChange?: (appState: AppState, previousAppState?: AppState) => void;
  registerComponentApi?: (api: SharedAppStateApi) => void;
  updateState?: (componentState: { value: AppState }, options?: { initial?: boolean }) => void;
  value?: AppState;
};

type SharedAppStateApi = {
  dispatch: (action: Action) => AppState;
  dispatchSetTheme: (themeId: string) => AppState;
  dispatchSetGlobalSetting: (key: string, value: unknown) => AppState;
  dispatchSelectActivity: (activityId: string) => AppState;
  activateActivity: (activityId: string) => AppState;
  globalSettings: (key: string, defaultValue?: unknown) => unknown;
  getSettingValue: (key: string) => Promise<unknown>;
  getAllSettingValues: () => Promise<Record<string, unknown>>;
  setSettingValue: (key: string, value: unknown) => Promise<unknown>;
  update: (key: string, value: unknown) => AppState;
  windowKind: () => "emu" | "ide";
  isEmulatorWindow: () => boolean;
};

const noopUpdateState = () => {};

function isEmulatorWindow(): boolean {
  return windowKind === "emu";
}

function readPath(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return (value as Record<string, unknown>)[segment];
  }, source);
}

function readGlobalSetting(state: AppState, key: string, defaultValue?: unknown): unknown {
  const globalSettings = state.globalSettings ?? {};
  const directValue = readPath(globalSettings, key);
  if (directValue !== undefined) {
    return directValue;
  }

  if (key.indexOf(".") >= 0) {
    return defaultValue;
  }

  const prefixes = isEmulatorWindow()
    ? ["emuViewOptions", "emuOptions"]
    : ["ideViewOptions", "ideBehavior", "editorOptions"];

  for (const prefix of prefixes) {
    const value = readPath(globalSettings, `${prefix}.${key}`);
    if (value !== undefined) {
      return value;
    }
  }

  return defaultValue;
}

export const SharedAppStateReact = ({
  fireDidChangeOnInit = true,
  onDidChange,
  registerComponentApi,
  updateState = noopUpdateState,
  value
}: SharedAppStateReactProps) => {
  const sharedState = useSharedState();
  const dispatch = useDispatch();
  const dispatchSetTheme = useDispatchSetTheme();
  const dispatchSetGlobalSetting = useDispatchSetGlobalSetting();
  const dispatchSelectActivity = useDispatchSelectActivity();
  const dispatchActivateActivity = useDispatchActivateActivity();
  const readAllSettingValues = useReadAllSettingValues();
  const readSettingValue = useReadSettingValue();
  const updateSettingValue = useUpdateSettingValue();
  const valueRef = useRef<AppState>(value ?? sharedState);
  const fireDidChangeOnInitRef = useRef(fireDidChangeOnInit);
  const initialDidChangeFiredRef = useRef(false);
  const onDidChangeRef = useRef(onDidChange);
  const updateStateRef = useRef(updateState);

  useEffect(() => {
    fireDidChangeOnInitRef.current = fireDidChangeOnInit;
  }, [fireDidChangeOnInit]);

  useEffect(() => {
    onDidChangeRef.current = onDidChange;
  }, [onDidChange]);

  useEffect(() => {
    updateStateRef.current = updateState;
  }, [updateState]);

  const setCurrentValue = useCallback(
    (nextValue: AppState, options?: { initial?: boolean }) => {
      const previousValue = valueRef.current;
      if (previousValue === nextValue && !options?.initial) {
        return nextValue;
      }

      valueRef.current = nextValue;
      updateStateRef.current({ value: nextValue }, options);
      if (options?.initial) {
        return nextValue;
      }
      if (!options?.initial && previousValue !== nextValue) {
        onDidChangeRef.current?.(nextValue, previousValue);
      }
      return nextValue;
    },
    []
  );

  useLayoutEffect(() => {
    if (value) {
      valueRef.current = value;
    }
  }, [value]);

  useLayoutEffect(() => {
    setCurrentValue(getSharedState(), { initial: true });
  }, [setCurrentValue]);

  useEffect(() => {
    if (!fireDidChangeOnInit || initialDidChangeFiredRef.current || !onDidChange) {
      return;
    }

    const currentState = getSharedState();
    initialDidChangeFiredRef.current = true;
    valueRef.current = currentState;
    updateStateRef.current({ value: currentState }, { initial: true });
    onDidChange(currentState);
  }, [fireDidChangeOnInit, onDidChange]);

  const setLocalValue = useCallback((nextValue: AppState) => {
    valueRef.current = nextValue;
    return nextValue;
  }, []);

  const api = useMemo<SharedAppStateApi>(
    () => ({
      dispatch(action: Action) {
        const nextValue = dispatch(action);
        return setCurrentValue(nextValue);
      },
      dispatchSetTheme(themeId: string) {
        const nextValue = dispatchSetTheme(themeId);
        return setCurrentValue(nextValue);
      },
      dispatchSetGlobalSetting(key: string, next: unknown) {
        const nextValue = dispatchSetGlobalSetting(key, next);
        return setCurrentValue(nextValue);
      },
      dispatchSelectActivity(activityId: string) {
        const nextValue = dispatchSelectActivity(activityId);
        return setCurrentValue(nextValue);
      },
      activateActivity(activityId: string) {
        const nextValue = dispatchActivateActivity(activityId);
        return setCurrentValue(nextValue);
      },
      globalSettings(key: string, defaultValue?: unknown) {
        return readGlobalSetting(valueRef.current, key, defaultValue);
      },
      getSettingValue(key: string) {
        return readSettingValue(key);
      },
      getAllSettingValues() {
        return readAllSettingValues();
      },
      setSettingValue(key: string, next: unknown) {
        return updateSettingValue(key, next);
      },
      windowKind() {
        return windowKind;
      },
      isEmulatorWindow() {
        return windowKind === "emu";
      },
      update(key: string, next: unknown) {
        const nextValue = dispatchSetGlobalSetting(key, next);
        return setCurrentValue(nextValue);
      }
    }),
    [
      dispatch,
      dispatchActivateActivity,
      dispatchSelectActivity,
      dispatchSetGlobalSetting,
      dispatchSetTheme,
      readAllSettingValues,
      readSettingValue,
      setCurrentValue,
      updateSettingValue
    ]
  );

  useEffect(() => {
    registerComponentApi?.(api);
  }, [api, registerComponentApi]);

  useLayoutEffect(() => {
    setCurrentValue(sharedState);
  }, [setCurrentValue, sharedState]);

  useEffect(() => {
    const currentState = getSharedState();
    if (valueRef.current !== currentState) {
      setLocalValue(currentState);
    }
  }, [setLocalValue]);

  return null;
};
