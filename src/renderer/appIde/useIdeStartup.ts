import { MessengerBase } from "@common/messaging/MessengerBase";
import { createMainApi } from "@common/messaging/MainApi";
import { SETTING_IDE_OPEN_LAST_PROJECT } from "@common/settings/setting-const";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { AppServices } from "@renderer/abstractions/AppServices";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { getGlobalSetting } from "@renderer/core/RendererProvider";
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
import { initializeMonaco } from "./DocumentPanels/MonacoEditor";
import { registerIdeCommands } from "./IdeCommands";
import { registerMainToIdeIpc } from "./MainToIdeIpc";

type Dispatch = (action: any) => void;

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

  useEffect(() => registerMainToIdeIpc(), []);

  useLayoutEffect(() => {
    console.log("AppPath", appPath);
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
      let counter = 0;
      while (counter < 100) {
        if (store.getState().ideStateSynched) break;
        counter++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (cancelled || counter >= 100) return;

      const mainApi = createMainApi(messenger);
      const openLastProject = getGlobalSetting(store, SETTING_IDE_OPEN_LAST_PROJECT);
      if (openLastProject) {
        const settings = await mainApi.getAppSettings();
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
  }, [ideLoaded, messenger, store]);
}
