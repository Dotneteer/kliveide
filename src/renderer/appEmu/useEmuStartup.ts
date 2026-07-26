import { MessengerBase } from "@common/messaging/MessengerBase";
import { MainApi } from "@common/messaging/MainApi";
import { AppState } from "@common/state/AppState";
import { Dispatch, Store } from "@common/state/redux-light";
import { AppServices } from "@renderer/abstractions/AppServices";
import {
  setCachedAppServices,
  setCachedMessenger,
  setCachedStore
} from "@renderer/CachedServices";
import { setIsWindows } from "@renderer/os-utils";
import { emuLoadedAction, setAudioSampleRateAction } from "@state/actions";
import { MutableRefObject, useEffect, useRef } from "react";
import { setEmuRecordingManager } from "./MainToEmuProcessor";
import { registerMainToEmuIpc } from "./MainToEmuIpc";
import { RecordingManager } from "./recording/RecordingManager";

type EmuStartupArgs = {
  appServices: AppServices;
  dispatch: Dispatch;
  isWindows: boolean;
  messenger: MessengerBase;
  store: Store<AppState>;
};

export function useEmuRecordingManager(
  mainApi: MainApi,
  dispatch: Dispatch
): MutableRefObject<RecordingManager | null> {
  const recordingManagerRef = useRef<RecordingManager | null>(null);
  if (!recordingManagerRef.current) {
    recordingManagerRef.current = new RecordingManager(mainApi, dispatch);
    setEmuRecordingManager(recordingManagerRef.current);
  }
  return recordingManagerRef;
}

export function useEmuStartup({
  appServices,
  dispatch,
  isWindows,
  messenger,
  store
}: EmuStartupArgs): void {
  const mounted = useRef(false);

  useEffect(() => registerMainToEmuIpc(), []);

  useEffect(() => {
    setCachedAppServices(appServices);
    setCachedMessenger(messenger);
    setCachedStore(store);

    if (!appServices || !store || !messenger || mounted.current) return;

    mounted.current = true;
    dispatch(emuLoadedAction());
    window.postMessage({ payload: "removeLoading" }, "*");

    const audioCtx = new AudioContext();
    try {
      dispatch(setAudioSampleRateAction(audioCtx.sampleRate));
    } finally {
      audioCtx.close().catch(console.error);
    }
  }, [appServices, dispatch, messenger, store]);

  useEffect(() => {
    setIsWindows(isWindows);
  }, [isWindows]);
}
