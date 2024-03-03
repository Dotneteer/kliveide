import { AppServices } from "@renderer/abstractions/AppServices";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { BackDrop } from "@controls/BackDrop";
import { Toolbar } from "@controls/Toolbar";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import {
  RequestMessage,
  NotReadyResponse,
  errorResponse,
  ResponseMessage
} from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import {
  displayDialogAction,
  emuLoadedAction,
  setAudioSampleRateAction
} from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import styles from "@styles/app.module.scss";
import { ipcRenderer } from "electron";
import { useRef, useEffect } from "react";
import { EmulatorArea } from "./EmulatorArea/EmulatorArea";
import { processMainToEmuMessages } from "./MainToEmuProcessor";
import { EmuStatusBar } from "./StatusBar/EmuStatusBar";
import {
  CREATE_DISK_DIALOG,
  FIRST_STARTUP_DIALOG_EMU,
  Z88_CARDS_DIALOG,
  Z88_REMOVE_CARDS_DIALOG
} from "@common/messaging/dialog-ids";
import { FirstStartDialog } from "@renderer/appIde/dialogs/FirstStartDialog";
import { Z88CardsDialog } from "./dialogs/Z88CardsDialog";
import { CreateDiskDialog } from "./dialogs/CreateDiskDialog";
import { Z88RemoveCardDialog } from "./dialogs/Z88RemoveCardDialog";

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
  const kliveProjectLoaded = useSelector(
    s => s.project?.isKliveProject ?? false
  );
  const dimmed = useSelector(s => s.dimMenu ?? false);
  const dialogId = useSelector(s => s.ideView?.dialogToDisplay);
  const dialogData = useSelector(s => s.ideView?.dialogData);

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
    try {
      var ctx = new AudioContext();
      const sampleRate = audioCtx.sampleRate;
      dispatch(setAudioSampleRateAction(sampleRate));
    } finally {
      // The specification doesn't go into a lot of detail about things like how many
      // audio contexts a user agent should support, or minimum or maximum latency
      // requirements (if any), so these details can vary from browser to browser.
      // More details: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext
      ctx?.close().catch(console.error);
    }
  }, [appServices, store, messenger]);

  return (
    <div id='appMain' className={styles.app}>
      {showToolbar && (
        <Toolbar ide={false} kliveProjectLoaded={kliveProjectLoaded} />
      )}
      <EmulatorArea />
      <EmuStatusBar show={showStatusBar} />
      <BackDrop visible={dimmed} />

      {dialogId === FIRST_STARTUP_DIALOG_EMU && (
        <FirstStartDialog
          onClose={() => {
            store.dispatch(displayDialogAction());
          }}
        />
      )}
      {dialogId === Z88_CARDS_DIALOG && (
        <Z88CardsDialog
          onClose={() => {
            store.dispatch(displayDialogAction());
          }}
        />
      )}
      {dialogId === Z88_REMOVE_CARDS_DIALOG && (
        <Z88RemoveCardDialog slot={dialogData}
          onClose={() => {
            store.dispatch(displayDialogAction());
          }}
        />
      )}
      {dialogId === CREATE_DISK_DIALOG && (
        <CreateDiskDialog
          onClose={() => {
            store.dispatch(displayDialogAction());
          }}
        />
      )}
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

  let response: ResponseMessage;
  try {
    response = await processMainToEmuMessages(
      msg,
      storeCached,
      messengerCached,
      appServicesCached
    );
  } catch (err) {
    // --- In case of errors (rejected promises), retrieve an error response
    response = errorResponse(err.toString());
  }

  // --- Set the correlation ID to let the caller identify the response
  response.correlationId = msg.correlationId;
  response.sourceId = "emu";
  ipcRenderer.send("MainToEmuResponse", response);
});
