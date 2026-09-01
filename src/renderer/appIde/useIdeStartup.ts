import { get } from "lodash";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { createMainApi } from "@common/messaging/MainApi";
import { SETTING_IDE_OPEN_LAST_PROJECT } from "@common/settings/setting-const";
import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { AppState } from "@common/state/AppState";
import { Dispatch, Store } from "@common/state/redux-light";
import { AppServices } from "@renderer/abstractions/AppServices";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { activityRegistry, toolPanelRegistry } from "@renderer/registry";
import { setCachedAppServices, setCachedStore } from "@renderer/CachedServices";
import { setIsWindows } from "@renderer/os-utils";
import {
  ideLoadedAction,
  selectActivityAction,
  setAudioSampleRateAction,
  setToolsAction
} from "@state/actions";
import { useEffect, useLayoutEffect, useRef } from "react";
import { initializeMonaco } from "@renderer/features/editor/monaco/MonacoEditor";
import { registerIdeCommands } from "./IdeCommands";

type IdeStartupArgs = {
  appPath: string;
  appServices: AppServices;
  dispatch: Dispatch;
  ideLoaded: boolean;
  isWindows: boolean;
  messenger: MessengerBase;
  store: Store<AppState>;
};

export function useEnsureIdeDocumentHub(appServices: AppServices): void {
  if (!appServices.projectService.getActiveDocumentHubService()) {
    appServices.projectService.createDocumentHubService();
  }
}

export function useIdeStartup({
  appPath,
  appServices,
  dispatch,
  ideLoaded,
  isWindows,
  messenger,
  store
}: IdeStartupArgs): void {
  const mounted = useRef(false);

  // --- NOTE: the "MainToIde" IPC listener is intentionally NOT registered here. It is registered
  // --- at module load time in `renderer/main.tsx`, because a React effect runs too late: the main
  // --- process can broadcast its initial state before this component ever commits, and Electron
  // --- silently drops messages sent to a channel with no listener.

  useLayoutEffect(() => {
    initializeMonaco();

    setCachedAppServices(appServices);
    setCachedStore(store);

    if (!appServices || !store || !messenger || mounted.current) return;

    mounted.current = true;
    registerIdeCommands(appServices.ideCommandsService);

    const audioCtx = new AudioContext();
    try {
      dispatch(setAudioSampleRateAction(audioCtx.sampleRate));
    } finally {
      void audioCtx.close();
    }

    dispatch(selectActivityAction(activityRegistry[0].id));
    const regTools = toolPanelRegistry.map((t) => {
      return {
        id: t.id,
        name: t.name,
        visible: t.visible ?? true
      } as ToolInfo;
    });
    dispatch(setToolsAction(regTools));
    dispatch(ideLoadedAction());

    window.postMessage({ payload: "removeLoading" }, "*");
  }, [appPath, appServices, dispatch, messenger, store]);

  useEffect(() => {
    setIsWindows(isWindows);
  }, [isWindows]);

  useEffect(() => {
    if (!ideLoaded) return;

    let cancelled = false;
    (async () => {
      // --- Read the "open last project" setting and the last project's path directly from the
      // --- main process via a request/response IPC call, rather than from this window's own
      // --- redux store. The store's copy of global settings only becomes available once the main
      // --- process broadcasts INIT_GLOBAL_SETTINGS and this window's IPC listener has already been
      // --- registered to receive it - that broadcast is fire-and-forget (no ack, no queue, no
      // --- retry), gated only on the EMU window's readiness, and can be lost entirely if it races
      // --- ahead of this window's listener registration (this has been observed on Windows, where
      // --- the IDE window's heavier startup - e.g. initializing Monaco - can lag behind EMU's).
      // --- Going straight to main sidesteps that race: this call always gets a real answer.
      const mainApi = createMainApi(messenger);
      const settings = await mainApi.getAppSettings();
      if (cancelled) return;

      const settingDef = KliveGlobalSettings[SETTING_IDE_OPEN_LAST_PROJECT];
      const openLastProject = get(
        settings?.globalSettings ?? {},
        SETTING_IDE_OPEN_LAST_PROJECT,
        settingDef?.defaultValue
      );
      if (openLastProject) {
        let projectPath = settings?.project?.folderPath;
        if (projectPath && !cancelled) {
          projectPath = projectPath.replaceAll("\\", "/");
          await mainApi.openFolder(projectPath);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ideLoaded, messenger]);
}
