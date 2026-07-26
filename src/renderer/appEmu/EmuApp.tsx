import { useAppServices } from "@appIde/services/AppServicesProvider";
import { BackDrop } from "@controls/BackDrop";
import { Toolbar } from "@controls/Toolbar";
import {
  useDispatch,
  useGlobalSetting,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { displayDialogAction } from "@state/actions";
import { EmulatorArea } from "@renderer/features/emulator/EmulatorArea";
import { EmuStatusBar } from "./StatusBar/EmuStatusBar";
import { RecordingContext } from "./recording/RecordingContext";
import { useMainApi } from "@renderer/core/MainApi";
import { FullPanel } from "@renderer/controls/layout/Panels";
import {
  SETTING_EMU_SHOW_STATUS_BAR,
  SETTING_EMU_SHOW_TOOLBAR
} from "@common/settings/setting-const";
import { EmuDialogHost } from "./EmuDialogHost";
import { useEmuRecordingManager, useEmuStartup } from "./useEmuStartup";

const EmuApp = () => {
  // --- Used services
  const dispatch = useDispatch();
  const appServices = useAppServices();
  const { store, messenger } = useRendererContext();
  const mainApi = useMainApi();

  const recordingManagerRef = useEmuRecordingManager(mainApi, dispatch);

  // --- Visual state
  const showToolbar = useGlobalSetting(SETTING_EMU_SHOW_TOOLBAR);
  const showStatusBar = useGlobalSetting(SETTING_EMU_SHOW_STATUS_BAR);
  const kliveProjectLoaded = useSelector((s) => s.project?.isKliveProject ?? false);
  const dimmed = useSelector((s) => s.dimMenu ?? false);
  const isWindows = useSelector((s) => s.isWindows ?? false);
  const dialogId = useSelector((s) => s.ideView?.dialogToDisplay);
  const dialogData = useSelector((s) => s.ideView?.dialogData);

  useEmuStartup({ appServices, dispatch, isWindows, messenger, store });

  return (
    <RecordingContext.Provider value={recordingManagerRef}>
    <FullPanel id="appMain" data-testid="emu-app">
      {showToolbar && <Toolbar ide={false} kliveProjectLoaded={kliveProjectLoaded} recordingManagerRef={recordingManagerRef} />}
      <EmulatorArea />
      <EmuStatusBar show={showStatusBar} />
      <BackDrop visible={dimmed} />
      <EmuDialogHost
        dialogData={dialogData}
        dialogId={dialogId}
        onClose={() => store.dispatch(displayDialogAction())}
      />
    </FullPanel>
    </RecordingContext.Provider>
  );
};

export default EmuApp;
