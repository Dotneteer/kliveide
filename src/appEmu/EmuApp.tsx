import styles from "@styles/app.module.scss";
import { EmulatorArea } from "../controls/EmulatorArea/EmulatorArea";
import { StatusBar } from "../controls/StatusBar/StatusBar";
import { Toolbar } from "../controls/Toolbar/Toolbar";
import { useEffect, useRef } from "react";
import { 
  setAudioSampleRateAction, 
  uiLoadedAction 
} from "@state/actions";
import { ipcRenderer } from "electron";
import { RequestMessage } from "@messaging/messages-core";
import { useDispatch, useMessenger, useSelector, useStore } from "../core/StoreProvider";
import { processMainToEmuMessages } from "./MainToEmuProcessor";
import { AppServices } from "@/ide/abstractions";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { useAppServices } from "@/ide/AppServicesProvider";

// --- Store the singleton instances we use for message processing (out of React)
let appServicesCached: AppServices;
let messengerCached: MessengerBase;
let storeCached: Store<AppState>;

const EmuApp = () => {
  // --- Indicate the App has been loaded
  const mounted = useRef(false);
  const dispatch = useDispatch();

  const appServices = useAppServices();
  const messenger = useMessenger();
  const store = useStore();

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
  const showToolbar = useSelector(s => s.ideViewOptions.showToolbar);
  const showStatusBar = useSelector(s => s.ideViewOptions.showStatusBar);

  // --- Signify that the UI has been loaded
  useEffect(() => {
      if (mounted.current) return;

      // --- Sign that the UI is ready
      mounted.current = true;
      dispatch(uiLoadedAction());

      // --- Set the audio sample rate to use
      const audioCtx = new AudioContext();
      const sampleRate = audioCtx.sampleRate;
      audioCtx.close();
      dispatch(setAudioSampleRateAction(sampleRate));

      return () => {
          mounted.current = false;
      }
  });

  return (
    <div className={styles.app}>
      {showToolbar && <Toolbar />}
      <EmulatorArea />
      {showStatusBar && <StatusBar />}
    </div>
  )
}

export default EmuApp

// --- This channel processes main requests and sends the results back
ipcRenderer.on("MainToemu", async (_ev, msg: RequestMessage) => {
  const response = await processMainToEmuMessages(
    msg,
    storeCached,
    messengerCached,
    appServicesCached
  );
  response.correlationId = msg.correlationId;
  ipcRenderer.send("MainToEmuResponse", response);
});
