import { useDispatch, useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { muteSoundAction } from "@state/actions";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { MutableRefObject, useCallback } from "react";
import { machineRegistry } from "@common/machines/machine-registry";
import { MF_TAPE_SUPPORT } from "@common/machines/constants";
import { useMainApi } from "@renderer/core/MainApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import type { RecordingManager } from "@renderer/appEmu/recording/RecordingManager";
import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_STAY_ON_TOP
} from "@common/settings/setting-const";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { MachineControllerState } from "@abstractions/MachineControllerState";

type Props = {
  recordingManagerRef?: MutableRefObject<RecordingManager | null>;
};

export const ViewControls = ({ recordingManagerRef }: Props) => {
  const dispatch = useDispatch();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const state = useSelector((s) => s.emulatorState?.machineState);
  const showKeyboard = useGlobalSetting(SETTING_EMU_SHOW_KEYBOARD);
  const showInstantScreen = useGlobalSetting(SETTING_EMU_SHOW_INSTANT_SCREEN);
  const stayOnTop = useGlobalSetting(SETTING_EMU_STAY_ON_TOP);
  const recState = useSelector((s) => s.emulatorState?.screenRecordingState);
  const recordingAvailable = useSelector((s) => s.emulatorState?.screenRecordingAvailable !== false);
  const muted = useSelector((s) => s.emulatorState?.soundMuted ?? false);
  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  const tapeFile = useSelector((s) => s.media?.[MEDIA_TAPE]);
  const isRunning =
    state !== MachineControllerState.None &&
    state !== MachineControllerState.Stopped &&
    state !== MachineControllerState.Paused;
  const tapeSupport = machineInfo?.features?.[MF_TAPE_SUPPORT] ?? false;

  const saveProject = useCallback(async () => {
    await mainApi.saveProject();
  }, [mainApi]);

  return (
    <>
      <ToolbarSeparator />
      <IconButton
        iconName={stayOnTop ? "pinned" : "pin"}
        fill="--color-toolbarbutton"
        selected={stayOnTop}
        title={"Stay on top"}
        clicked={async () => {
          await mainApi.setGlobalSettingsValue(SETTING_EMU_STAY_ON_TOP, !stayOnTop);
        }}
      />
      <ToolbarSeparator />
      <IconButton
        iconName="vm"
        fill="--color-toolbarbutton"
        selected={showInstantScreen}
        title="Turn on/off instant screen"
        clicked={async () => {
          await mainApi.setGlobalSettingsValue(SETTING_EMU_SHOW_INSTANT_SCREEN, !showInstantScreen);
        }}
      />
      <ToolbarSeparator />
      <IconButton
        iconName="keyboard"
        fill="--color-toolbarbutton"
        selected={showKeyboard}
        title="Show/Hide keyboard"
        clicked={async () => {
          await mainApi.setGlobalSettingsValue(SETTING_EMU_SHOW_KEYBOARD, !showKeyboard);
        }}
      />
      <ToolbarSeparator />
      {!muted && (
        <IconButton
          iconName="mute"
          fill="--color-toolbarbutton"
          title="Mute sound"
          clicked={async () => {
            dispatch(muteSoundAction(true));
            await saveProject();
          }}
        />
      )}
      {muted && (
        <IconButton
          iconName="unmute"
          fill="--color-toolbarbutton"
          title="Unmute sound"
          clicked={async () => {
            dispatch(muteSoundAction(false));
            await saveProject();
          }}
        />
      )}
      {tapeSupport && <ToolbarSeparator />}
      {tapeSupport && (
        <IconButton
          iconName="rocket"
          fill="--color-toolbarbutton"
          title="Fast LOAD mode"
          selected={fastLoad}
          clicked={async () => {
            await mainApi.setGlobalSettingsValue(SETTING_EMU_FAST_LOAD, !fastLoad);
          }}
        />
      )}
      {tapeSupport && (
        <IconButton
          iconName="reverse-tape"
          fill="--color-toolbarbutton"
          title="Rewind the tape"
          enable={!!tapeFile}
          clicked={async () => {
            await mainApi.reloadTapeFile();
            await emuApi.issueMachineCommand("rewind");
          }}
        />
      )}
      <ToolbarSeparator />
      {recordingAvailable && (
        <IconButton
          iconName="record"
          fill={
            !recState || recState === "idle"
              ? undefined
              : recState === "armed"
                ? "#ffd700"
                : recState === "recording"
                  ? "#ff4444"
                  : "#ff8800"
          }
          selected={recState === "recording" || recState === "armed"}
          title={
            !recState || recState === "idle"
              ? "Start recording \u2014 use Machine \u203a Recording to choose fps"
              : recState === "armed"
                ? "Ready \u2013 waiting for machine to run (click to cancel)"
                : recState === "recording"
                  ? "Recording... (click to stop)"
                  : "Recording paused (click to stop)"
          }
          clicked={
            !recState || recState === "idle"
              ? () => recordingManagerRef?.current?.arm(undefined, isRunning)
              : () => recordingManagerRef?.current?.disarm()
          }
        />
      )}
    </>
  );
};
