import styles from "@styles/app.module.scss";
import { EmulatorArea } from "./EmulatorArea/EmulatorArea";
import { EmuStatusBar } from "./StatusBar/EmuStatusBar";
import { Toolbar } from "../controls/Toolbar";
import { useEffect, useRef } from "react";
import { setAudioSampleRateAction, emuLoadedAction } from "@state/actions";
import { ipcRenderer } from "electron";
import { NotReadyResponse, RequestMessage } from "@messaging/messages-core";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "../core/RendererProvider";
import { processMainToEmuMessages } from "./MainToEmuProcessor";
import { AppServices } from "@/appIde/abstractions";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { useAppServices } from "@/appIde/services/AppServicesProvider";

// --- Store the singleton instances we use for message processing (out of React)
let appServicesCached: AppServices;
let messengerCached: MessengerBase;
let storeCached: Store<AppState>;

const EmuApp = () => {
  // --- Used services
  const dispatch = useDispatch();
  const appServices = useAppServices();
  const { store, messenger } = useRendererContext();

  // --- Visual state
  const showToolbar = useSelector(s => s.emuViewOptions.showToolbar);
  const showStatusBar = useSelector(s => s.emuViewOptions.showStatusBar);

  // --- Use the current instance of the app services
  const mounted = useRef(false);
  useEffect(() => {
    appServicesCached = appServices;
    messengerCached = messenger;
    storeCached = store;

    // --- Whenever each of these props are known, we can state the UI is loaded
    if (!appServices || !store || !messenger || mounted.current) return;

    // --- Run the app initialiation sequence
    mounted.current = true;
    dispatch(emuLoadedAction());

    // --- Set the audio sample rate to use
    const audioCtx = new AudioContext();
    const sampleRate = audioCtx.sampleRate;
    audioCtx.close();
    dispatch(setAudioSampleRateAction(sampleRate));
  }, [appServices, store, messenger]);

  return (
    <div className={styles.app}>
      {showToolbar && <Toolbar />}
      <EmulatorArea />
      {showStatusBar && <EmuStatusBar />}
    </div>
  );
};

export default EmuApp;

// --- This channel processes main requests and sends the results back
ipcRenderer.on("MainToEmu", async (_ev, msg: RequestMessage) => {
  // --- Do not process messages coming while app services are not cached.
  if (!appServicesCached) {
    ipcRenderer.send("MainToEmuResponse", {
      type: "NotReady"
    } as NotReadyResponse);
    return;
  }

  const response = await processMainToEmuMessages(
    msg,
    storeCached,
    messengerCached,
    appServicesCached
  );
  response.correlationId = msg.correlationId;
  response.sourceId = "emu";
  ipcRenderer.send("MainToEmuResponse", response);
});
