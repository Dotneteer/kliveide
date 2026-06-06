import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Action } from "../../../common/state/Action";
import type { AppState } from "../../../common/state/AppState";
import {
  getSharedState,
  useReadAllSettingValues,
  useDispatch,
  useDispatchSetGlobalSetting,
  useDispatchSetTheme,
  useReadSettingValue,
  useSharedState,
  useUpdateSettingValue
} from "../../shared-store";

type SharedAppStateReactProps = {
  registerComponentApi?: (api: SharedAppStateApi) => void;
  updateState?: (componentState: { value: AppState }, options?: { initial?: boolean }) => void;
  value?: AppState;
};

type SharedAppStateApi = {
  dispatch: (action: Action) => AppState;
  dispatchSetTheme: (themeId: string) => AppState;
  dispatchSetGlobalSetting: (key: string, value: unknown) => AppState;
  getSettingValue: (key: string) => Promise<unknown>;
  getAllSettingValues: () => Promise<Record<string, unknown>>;
  setSettingValue: (key: string, value: unknown) => Promise<unknown>;
  update: (key: string, value: unknown) => AppState;
};

const noopUpdateState = () => {};

export const SharedAppStateReact = ({
  registerComponentApi,
  updateState = noopUpdateState,
  value
}: SharedAppStateReactProps) => {
  const sharedState = useSharedState();
  const dispatch = useDispatch();
  const dispatchSetTheme = useDispatchSetTheme();
  const dispatchSetGlobalSetting = useDispatchSetGlobalSetting();
  const readAllSettingValues = useReadAllSettingValues();
  const readSettingValue = useReadSettingValue();
  const updateSettingValue = useUpdateSettingValue();
  const valueRef = useRef<AppState>(value ?? sharedState);

  const setCurrentValue = useCallback(
    (nextValue: AppState, options?: { initial?: boolean }) => {
      valueRef.current = nextValue;
      updateState({ value: nextValue }, options);
      return nextValue;
    },
    [updateState]
  );

  useLayoutEffect(() => {
    if (value) {
      valueRef.current = value;
    }
  }, [value]);

  useLayoutEffect(() => {
    setCurrentValue(getSharedState(), { initial: true });
  }, [setCurrentValue]);

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
      getSettingValue(key: string) {
        return readSettingValue(key);
      },
      getAllSettingValues() {
        return readAllSettingValues();
      },
      setSettingValue(key: string, next: unknown) {
        return updateSettingValue(key, next);
      },
      update(key: string, next: unknown) {
        const nextValue = dispatchSetGlobalSetting(key, next);
        return setCurrentValue(nextValue);
      }
    }),
    [
      dispatch,
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
