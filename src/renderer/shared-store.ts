import { useCallback, useSyncExternalStore } from "react";
import type { RequestMessage } from "../common/messaging/messages-core";
import type { Action } from "../common/state/Action";
import type { AppState } from "../common/state/AppState";
import {
  selectActivityAction,
  setAppPathAction,
  setGlobalSettingAction,
  setThemeAction
} from "../common/state/actions";
import type { Store } from "../common/state/redux-light";
import type { MessageSource } from "../common/messaging/messages-core";
import createAppStore from "../common/state/store";
import type { MainApi } from "../common/messaging/MainApi";

export type DemoWindowKind = "emu" | "ide";

type RendererActionForwarder = (message: RequestMessage) => Promise<void>;

export const windowKind: DemoWindowKind = getWindowKind();

let rendererActionForwarder: RendererActionForwarder | undefined;
let mainApi: MainApi | undefined;

export const sharedStore = createAppStore(windowKind, async (action, source) => {
  if (source !== windowKind || !rendererActionForwarder) {
    return;
  }

  await rendererActionForwarder({
    type: "ForwardAction",
    action,
    sourceId: windowKind
  });
});

const appPath = getAppPath();
if (appPath) {
  sharedStore.dispatch(setAppPathAction(appPath), "main");
}

export function setRendererActionForwarder(forwarder: RendererActionForwarder): void {
  rendererActionForwarder = forwarder;
}

export function setMainApi(api: MainApi): void {
  mainApi = api;
}

export function getSharedState(): AppState {
  return sharedStore.getState();
}

export function dispatchSharedAction(action: Action, source: MessageSource = windowKind): AppState {
  sharedStore.dispatch(action, source);
  return sharedStore.getState();
}

export function dispatchSetTheme(themeId: string): AppState {
  return dispatchSharedAction(setThemeAction(themeId), windowKind);
}

export function dispatchSetGlobalSetting(id: string, value: unknown): AppState {
  return dispatchSharedAction(setGlobalSettingAction(id, value), windowKind);
}

export function dispatchSelectActivity(id: string): AppState {
  return dispatchSharedAction(selectActivityAction(id), windowKind);
}

function isPrimarySideBarVisible(state: AppState): boolean {
  const ideViewOptions = state.globalSettings?.ideViewOptions ?? {};
  return ideViewOptions.showPrimarySideBar ?? ideViewOptions.showSidebar ?? true;
}

export function dispatchActivateActivity(id: string): AppState {
  const currentState = getSharedState();
  const currentActivity = currentState.activeActivity ?? "explorer";
  const primarySideBarVisible = isPrimarySideBarVisible(currentState);

  if (currentActivity === id && primarySideBarVisible) {
    return dispatchSetGlobalSetting("ideViewOptions.showPrimarySideBar", false);
  }

  if (currentActivity !== id) {
    dispatchSelectActivity(id);
  }

  return isPrimarySideBarVisible(getSharedState())
    ? getSharedState()
    : dispatchSetGlobalSetting("ideViewOptions.showPrimarySideBar", true);
}

export async function readSettingValue(id: string): Promise<unknown> {
  return getMainApi().getSettingValue(id);
}

export async function readBinaryFile(path: string, resolveIn?: string): Promise<Uint8Array> {
  return getMainApi().readBinaryFile(path, resolveIn);
}

export async function saveGeneratedTapeFile(
  defaultName: string,
  contents: Uint8Array
): Promise<{ fileName?: string }> {
  return getMainApi().saveGeneratedTapeFile(defaultName, contents);
}

export async function updateSettingValue(id: string, value: unknown): Promise<unknown> {
  return getMainApi().setSettingValue(id, value);
}

export async function readAllSettingValues(): Promise<Record<string, unknown>> {
  return getMainApi().getAllSettingValues();
}

export function useStore(): Store<AppState, Action> {
  return sharedStore;
}

export function useSharedState(): AppState {
  return useSyncExternalStore(sharedStore.subscribe, sharedStore.getState, sharedStore.getState);
}

export function useDispatch() {
  return useCallback((action: Action) => dispatchSharedAction(action), []);
}

export function useDispatchSetTheme() {
  return useCallback((themeId: string) => dispatchSetTheme(themeId), []);
}

export function useDispatchSetGlobalSetting() {
  return useCallback((id: string, value: unknown) => dispatchSetGlobalSetting(id, value), []);
}

export function useDispatchSelectActivity() {
  return useCallback((id: string) => dispatchSelectActivity(id), []);
}

export function useDispatchActivateActivity() {
  return useCallback((id: string) => dispatchActivateActivity(id), []);
}

export function useReadSettingValue() {
  return useCallback((id: string) => readSettingValue(id), []);
}

export function useReadAllSettingValues() {
  return useCallback(() => readAllSettingValues(), []);
}

export function useUpdateSettingValue() {
  return useCallback((id: string, value: unknown) => updateSettingValue(id, value), []);
}

function getWindowKind(): DemoWindowKind {
  return new URLSearchParams(window.location.search).get("window") === "ide" ? "ide" : "emu";
}

function getAppPath(): string | undefined {
  const appPath = new URLSearchParams(window.location.search).get("apppath");
  return appPath ?? undefined;
}

export function getMainApi(): MainApi {
  if (!mainApi) {
    throw new Error("Main API is not ready.");
  }
  return mainApi;
}
