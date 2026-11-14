import { useAppServices } from "@appIde/services/AppServicesProvider";
import { BackDrop } from "@controls/BackDrop";
import { Toolbar } from "@controls/Toolbar";
import {
  useDispatch,
  useGlobalSetting,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { EmulatorArea } from "@renderer/features/emulator/EmulatorArea";
import { EmuStatusBar } from "./StatusBar/EmuStatusBar";
import { RecordingContext } from "./recording/RecordingContext";
import { useMainApi } from "@renderer/core/MainApi";
import { FullPanel } from "@renderer/controls/layout/Panels";
import {
  SETTING_EMU_SHOW_STATUS_BAR,
  SETTING_EMU_SHOW_PERFORMANCE_INFO,
  SETTING_EMU_SHOW_TOOLBAR
} from "@common/settings/setting-const";
import { EmuDialogBridge } from "./EmuDialogBridge";
import { useEmuRecordingManager, useEmuStartup } from "./useEmuStartup";
import { useEmuFileDrop } from "./useEmuFileDrop";
import { useCallback, useRef } from "react";
import { FullScreenEdgeBar } from "./fullScreen/FullScreenEdgeBar";
import { useCssPixelsPerPoint, useFullScreenChrome } from "./fullScreen/useFullScreenChrome";

const EmuApp = () => {
  // --- Used services
  const dispatch = useDispatch();
  const appServices = useAppServices();
  const { store, messenger } = useRendererContext();
  const mainApi = useMainApi();

  const recordingManagerRef = useEmuRecordingManager(mainApi, dispatch, store);

  // --- Visual state
  const showToolbar = useGlobalSetting(SETTING_EMU_SHOW_TOOLBAR);
  const showStatusBar = useGlobalSetting(SETTING_EMU_SHOW_STATUS_BAR);
  const showPerformanceInfo = useGlobalSetting(SETTING_EMU_SHOW_PERFORMANCE_INFO);
  const kliveProjectLoaded = useSelector((s) => s.project?.isKliveProject ?? false);
  const emuLoaded = useSelector((s) => s.emuLoaded ?? false);
  const dimmed = useSelector((s) => s.dimMenu ?? false);
  const isWindows = useSelector((s) => s.isWindows ?? false);

  // --- The full screen mode (`dev/plans/EMU_FULL_SCREEN_MODE_PLAN.md`): the toolbar and the status
  // --- bar leave the layout and slide in over the picture at the screen edges, whatever their settings
  const fullScreenMode = useSelector((s) => s.emuFullScreenMode ?? false);
  // --- The macOS menu bar slides down at the top edge too: the toolbar is revealed under it
  const topInsetPt = useSelector((s) => s.emuFullScreenTopInset ?? 0);
  const topInset = Math.round(topInsetPt * useCssPixelsPerPoint(fullScreenMode && topInsetPt > 0));
  const toolbarBarRef = useRef<HTMLDivElement>(null);
  const statusBarBarRef = useRef<HTMLDivElement>(null);
  const { toolbarShown, statusBarShown } = useFullScreenChrome(
    fullScreenMode,
    toolbarBarRef,
    statusBarBarRef,
    dimmed,
    topInset
  );

  useEmuStartup({ appServices, dispatch, isWindows, messenger, store });

  // --- Snapshots and tapes dropped onto the window (D10)
  const openDroppedFile = useCallback((path: string) => mainApi.openDroppedFile(path), [mainApi]);
  useEmuFileDrop(openDroppedFile);

  return (
    <RecordingContext.Provider value={recordingManagerRef}>
    <FullPanel id="appMain" data-testid="emu-app" dataAppReady={emuLoaded ? "true" : "false"}>
      <EmuDialogBridge />
      {/* --- The same elements in both modes: neither the bars nor `EmulatorArea` (the machine) remount */}
      <FullScreenEdgeBar
        edge="top"
        active={fullScreenMode}
        shown={toolbarShown}
        inset={topInset}
        ref={toolbarBarRef}
      >
        {(fullScreenMode || showToolbar) && (
          <Toolbar ide={false} kliveProjectLoaded={kliveProjectLoaded} recordingManagerRef={recordingManagerRef} />
        )}
      </FullScreenEdgeBar>
      <EmulatorArea />
      <FullScreenEdgeBar edge="bottom" active={fullScreenMode} shown={statusBarShown} ref={statusBarBarRef}>
        {/* --- In the mode it stays mounted while hidden, so it can slide; its readouts run only on screen */}
        <EmuStatusBar
          show={fullScreenMode || showStatusBar}
          live={!fullScreenMode || statusBarShown}
          showPerformanceInfo={showPerformanceInfo}
        />
      </FullScreenEdgeBar>
      <BackDrop visible={dimmed} />
    </FullPanel>
    </RecordingContext.Provider>
  );
};

export default EmuApp;
