import styles from "@styles/app.module.scss";
import { EmulatorArea } from "./EmulatorArea/EmulatorArea";
import { EmuStatusBar } from "./StatusBar/EmuStatusBar";
import { Toolbar } from "../controls/common/Toolbar";
import { useEffect, useRef } from "react";
import { setAudioSampleRateAction, emuLoadedAction } from "@state/actions";
import { ipcRenderer } from "electron";
import { RequestMessage } from "@messaging/messages-core";
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
  // --- Indicate the App has been loaded
  const mounted = useRef(false);
  const dispatch = useDispatch();

  const appServices = useAppServices();
  const { store, messenger, messageSource } = useRendererContext();

  // --- Use the current instance of the app services
  useEffect(() => {
    appServicesCached = appServices;
  }, [appServices]);

  // --- Use the current messenger instance
  useEffect(() => {
    messengerCached = messenger;
  }, [messenger]);

  // --- Use the current store instance
  useEffect(() => {
    storeCached = store;
  }, [store]);

  // --- Visual state
  const showToolbar = useSelector(s => s.emuViewOptions.showToolbar);
  const showStatusBar = useSelector(s => s.emuViewOptions.showStatusBar);

  // --- Signify that the UI has been loaded
  useEffect(() => {
    if (mounted.current) return;

    // --- Sign that the UI is ready
    mounted.current = true;
    dispatch(emuLoadedAction());

    // --- Set the audio sample rate to use
    const audioCtx = new AudioContext();
    const sampleRate = audioCtx.sampleRate;
    audioCtx.close();
    dispatch(setAudioSampleRateAction(sampleRate));

    return () => {
      mounted.current = false;
    };
  });

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
