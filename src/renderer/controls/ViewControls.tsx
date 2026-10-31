import { useDispatch, useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { muteSoundAction } from "@state/actions";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { MutableRefObject, useCallback } from "react";
import { machineRegistry } from "@common/machines/machine-registry";
import { BEAM_POSITION_MACHINE_IDS, MF_MOUSE_SUPPORT, MF_TAPE_SUPPORT } from "@common/machines/constants";
import { useMainApi } from "@renderer/core/MainApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import type { RecordingManager } from "@renderer/appEmu/recording/RecordingManager";
import { requestMouseCapture } from "@renderer/features/emulator/mouseCaptureBridge";
import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_MOUSE_CAPTURE,
  SETTING_EMU_SHOW_BEAM_POSITION,
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_STAY_ON_TOP
} from "@common/settings/setting-const";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { SECONDARY_ICON_SIZE, TOOLBAR_BUTTON_SIZE } from "./toolbar-constants";
import { ToolbarSplitAction } from "./ToolbarSplitAction";
import { SOUND_LEVELS } from "@common/machines/emulator-levels";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "./ContextMenu";
import { useT } from "@common/i18n/useT";
import { ToolbarGroup, type ToolbarOverflowItem } from "./ToolbarOverflow";

type Props = {
  recordingManagerRef?: MutableRefObject<RecordingManager | null>;
};


export const ViewControls = ({ recordingManagerRef }: Props) => {
  const t = useT();
  const dispatch = useDispatch();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const state = useSelector((s) => s.emulatorState?.machineState);
  const showKeyboard = useGlobalSetting(SETTING_EMU_SHOW_KEYBOARD);
  const showInstantScreen = useGlobalSetting(SETTING_EMU_SHOW_INSTANT_SCREEN);
  const showBeamPosition = useGlobalSetting(SETTING_EMU_SHOW_BEAM_POSITION);
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
  const mouseSupport = machineInfo?.features?.[MF_MOUSE_SUPPORT] ?? false;
  const mouseCaptureEnabled = !!useGlobalSetting(SETTING_EMU_MOUSE_CAPTURE);
  const mouseCaptured = useSelector((s) => s.emulatorState?.mouseCaptured ?? false);

  const soundLevel = useSelector((s) => s.emulatorState?.soundLevel);
  const windowRecording = useSelector((s) => s.emulatorState?.windowRecordingState === "recording");
  // --- The sound level and the recordings, next to their buttons (`.plans/MENU_REDESIGN_PLAN.md` §5)
  const [soundMenu, soundMenuApi] = useContextMenuState();
  const [recordMenu, recordMenuApi] = useContextMenuState();

  const saveProject = useCallback(async () => {
    await mainApi.saveProject();
  }, [mainApi]);

  const recIdle = !recState || recState === "idle";
  const beamSupport = BEAM_POSITION_MACHINE_IDS.includes(machineId);
  const toggle = (id: string, value: boolean) => async () => {
    await mainApi.setGlobalSettingsValue(id, !value);
  };
  const toggleMute = async () => {
    dispatch(muteSoundAction(!muted));
    await saveProject();
  };
  const toggleIdeEmuRecording = async () => {
    const problem = await mainApi.runUiAction("toggle-ide-emu-recording");
    if (problem) await mainApi.displayMessageBox("info", t("toolbar.record.ideEmuTitle"), problem);
  };
  const openMachineSettings = async () => {
    await mainApi.runUiAction("open-settings", "machine");
  };
  const openRecordingSettings = async () => {
    await mainApi.runUiAction("open-settings", "recording");
  };

  // --- The display switches, as menu items: the folded View options button and the More menu show
  // --- them while the strip is short of room (ToolbarOverflow.tsx)
  const viewItems: ToolbarOverflowItem[] = [
    {
      id: "stayOnTop",
      text: t("toolbar.view.stayOnTop"),
      iconName: stayOnTop ? "pinned" : "pin",
      iconFill: "--color-toolbarbutton",
      toggled: !!stayOnTop,
      clicked: toggle(SETTING_EMU_STAY_ON_TOP, !!stayOnTop)
    },
    {
      id: "instantScreen",
      text: t("toolbar.view.instantScreen"),
      iconName: "vm",
      iconFill: "--color-toolbarbutton",
      toggled: !!showInstantScreen,
      clicked: toggle(SETTING_EMU_SHOW_INSTANT_SCREEN, !!showInstantScreen)
    },
    // --- The beam position overlay (BEAM_POSITION_OVERLAY_PLAN D8): only on a machine with a raster
    // --- beam (not the Z88's LCD)
    ...(beamSupport
      ? [
          {
            id: "beamPosition",
            text: t("toolbar.view.beamPosition"),
            iconName: "scan-line",
            iconFill: "--color-toolbarbutton",
            toggled: !!showBeamPosition,
            clicked: toggle(SETTING_EMU_SHOW_BEAM_POSITION, !!showBeamPosition)
          }
        ]
      : []),
    {
      id: "keyboard",
      text: t("toolbar.view.keyboard"),
      iconName: "keyboard",
      iconFill: "--color-toolbarbutton",
      toggled: !!showKeyboard,
      clicked: toggle(SETTING_EMU_SHOW_KEYBOARD, !!showKeyboard)
    }
  ];

  const mouseTitle = mouseCaptureEnabled
    ? mouseCaptured
      ? t("toolbar.mouse.captured")
      : t("toolbar.mouse.capture")
    : t("toolbar.mouse.disabled");

  const soundItems: ToolbarOverflowItem[] = [
    {
      id: "mute",
      text: muted ? t("toolbar.sound.unmute") : t("toolbar.sound.mute"),
      iconName: muted ? "unmute" : "mute",
      iconFill: "--color-toolbarbutton",
      clicked: toggleMute
    },
    ...SOUND_LEVELS.map((level) => ({
      id: `sound-${level.value}`,
      text: level.label,
      selected: level.value === soundLevel,
      clicked: async () => {
        await mainApi.runUiAction("set:soundLevel", level.value);
      }
    }))
  ];

  const recordItems: ToolbarOverflowItem[] = [
    {
      id: "video",
      text: recIdle ? t("menu.machine.startVideo") : t("menu.machine.stopVideo"),
      iconName: "record-start",
      iconFill: "--color-toolbarbutton",
      disabled: recIdle && windowRecording,
      clicked: recIdle
        ? () => recordingManagerRef?.current?.arm(undefined, isRunning)
        : () => recordingManagerRef?.current?.disarm()
    },
    {
      id: "ideEmu",
      text: windowRecording ? t("toolbar.record.stopIdeEmu") : t("toolbar.record.startIdeEmu"),
      disabled: !windowRecording && !recIdle,
      clicked: toggleIdeEmuRecording
    },
    { id: "recordingSettings", text: t("menu.machine.recordingSettings"), clicked: openRecordingSettings }
  ];

  // --- Priorities: the lowest leaves the strip first when the window is too narrow for it
  return (
    <>
      {/* The running machine's own options: the Settings dialog's Machine page */}
      <ToolbarGroup
        id="machineSettings"
        priority={30}
        separator
        overflowItems={[
          {
            id: "machineSettings",
            text: t("toolbar.machineSettings"),
            iconName: "sliders-horizontal",
            iconFill: "--color-toolbarbutton",
            clicked: openMachineSettings
          }
        ]}
      >
        <IconButton
          iconName="sliders-horizontal"
          iconSize={SECONDARY_ICON_SIZE}
          buttonWidth={TOOLBAR_BUTTON_SIZE}
          buttonHeight={TOOLBAR_BUTTON_SIZE}
          fill="--color-toolbarbutton"
          title={t("toolbar.machineSettings")}
          clicked={openMachineSettings}
        />
      </ToolbarGroup>
      {/* The display switches: their own buttons while there is room, one View options button
          when the strip is short of it */}
      <ToolbarGroup
        id="view"
        priority={50}
        separator
        overflowItems={viewItems}
        collapse={{ iconName: "monitor-cog", title: t("toolbar.viewOptions") }}
      >
        <IconButton
          iconName={stayOnTop ? "pinned" : "pin"}
          iconSize={SECONDARY_ICON_SIZE}
          buttonWidth={TOOLBAR_BUTTON_SIZE}
          buttonHeight={TOOLBAR_BUTTON_SIZE}
          fill="--color-toolbarbutton"
          selected={stayOnTop}
          title={t("toolbar.stayOnTop")}
          clicked={toggle(SETTING_EMU_STAY_ON_TOP, !!stayOnTop)}
        />
        <ToolbarSeparator />
        <IconButton
          iconName="vm"
          iconSize={SECONDARY_ICON_SIZE}
          buttonWidth={TOOLBAR_BUTTON_SIZE}
          buttonHeight={TOOLBAR_BUTTON_SIZE}
          fill="--color-toolbarbutton"
          selected={showInstantScreen}
          title={t("toolbar.instantScreen")}
          clicked={toggle(SETTING_EMU_SHOW_INSTANT_SCREEN, !!showInstantScreen)}
        />
        {/* The beam position overlay (BEAM_POSITION_OVERLAY_PLAN D8): shown only while paused, and
            only on a machine with a raster beam (not the Z88's LCD) */}
        {beamSupport && (
          <IconButton
            iconName="scan-line"
            iconSize={SECONDARY_ICON_SIZE}
            buttonWidth={TOOLBAR_BUTTON_SIZE}
            buttonHeight={TOOLBAR_BUTTON_SIZE}
            fill="--color-toolbarbutton"
            selected={showBeamPosition}
            title={t("toolbar.beamPosition")}
            clicked={toggle(SETTING_EMU_SHOW_BEAM_POSITION, !!showBeamPosition)}
          />
        )}
        <ToolbarSeparator />
        <IconButton
          iconName="keyboard"
          iconSize={SECONDARY_ICON_SIZE}
          buttonWidth={TOOLBAR_BUTTON_SIZE}
          buttonHeight={TOOLBAR_BUTTON_SIZE}
          fill="--color-toolbarbutton"
          selected={showKeyboard}
          title={t("toolbar.keyboard")}
          clicked={toggle(SETTING_EMU_SHOW_KEYBOARD, !!showKeyboard)}
        />
      </ToolbarGroup>
      {mouseSupport && (
        <ToolbarGroup
          id="mouse"
          priority={40}
          separator
          overflowItems={[
            {
              id: "mouse",
              text: mouseTitle,
              iconName: mouseCaptured ? "mouse" : "mouse-off",
              iconFill: "--color-toolbarbutton",
              toggled: mouseCaptured,
              disabled: !mouseCaptureEnabled,
              // --- Synchronously, within the menu item's click: pointer lock needs its activation
              clicked: () => {
                requestMouseCapture();
              }
            }
          ]}
        >
          {/*
            * Captures the mouse; it cannot release it. While the pointer is locked every mouse
            * event goes to the locked element, so this button is unclickable until the user presses
            * Esc - which is why the title names Esc instead of promising a toggle. The icon and the
            * lit state still report which way round things are.
            *
            * The click has to reach the screen synchronously: pointer lock needs the transient
            * activation of this very event, so the request goes through the bridge rather than the
            * store.
            */}
          <IconButton
            iconName={mouseCaptured ? "mouse" : "mouse-off"}
            iconSize={SECONDARY_ICON_SIZE}
            buttonWidth={TOOLBAR_BUTTON_SIZE}
            buttonHeight={TOOLBAR_BUTTON_SIZE}
            fill="--color-toolbarbutton"
            selected={mouseCaptured}
            enable={mouseCaptureEnabled}
            title={mouseTitle}
            clicked={() => {
              requestMouseCapture();
            }}
          />
        </ToolbarGroup>
      )}
      <ToolbarGroup id="sound" priority={60} separator overflowItems={soundItems}>
        <ToolbarSplitAction
          iconName={muted ? "unmute" : "mute"}
          fill="--color-toolbarbutton"
          title={muted ? t("toolbar.sound.unmute") : t("toolbar.sound.mute")}
          clicked={toggleMute}
          dropdownTitle={t("toolbar.sound.level")}
          dropdownClicked={(e) => soundMenuApi.showAt(e.currentTarget)}
        />
      </ToolbarGroup>
      {soundMenu.contextVisible && (
        <ContextMenu state={soundMenu} onClickOutside={soundMenuApi.conceal}>
          {SOUND_LEVELS.map((level) => (
            <ContextMenuItem
              key={level.value}
              text={level.label}
              selected={level.value === soundLevel}
              clicked={async () => {
                soundMenuApi.conceal();
                await mainApi.runUiAction("set:soundLevel", level.value);
              }}
            />
          ))}
        </ContextMenu>
      )}
      {tapeSupport && (
        <ToolbarGroup
          id="tape"
          priority={10}
          separator
          overflowItems={[
            {
              id: "fastLoad",
              text: t("toolbar.fastLoad"),
              iconName: "rocket",
              iconFill: "--color-toolbarbutton",
              toggled: !!fastLoad,
              clicked: toggle(SETTING_EMU_FAST_LOAD, !!fastLoad)
            },
            {
              id: "rewind",
              text: t("toolbar.rewindTape"),
              iconName: "reverse-tape",
              iconFill: "--color-toolbarbutton",
              disabled: !tapeFile,
              clicked: async () => {
                await mainApi.reloadTapeFile();
                await emuApi.issueMachineCommand("rewind");
              }
            }
          ]}
        >
          <IconButton
            iconName="rocket"
            iconSize={SECONDARY_ICON_SIZE}
            buttonWidth={TOOLBAR_BUTTON_SIZE}
            buttonHeight={TOOLBAR_BUTTON_SIZE}
            fill="--color-toolbarbutton"
            title={t("toolbar.fastLoad")}
            selected={fastLoad}
            clicked={toggle(SETTING_EMU_FAST_LOAD, !!fastLoad)}
          />
          <IconButton
            iconName="reverse-tape"
            iconSize={SECONDARY_ICON_SIZE}
            buttonWidth={TOOLBAR_BUTTON_SIZE}
            buttonHeight={TOOLBAR_BUTTON_SIZE}
            fill="--color-toolbarbutton"
            title={t("toolbar.rewindTape")}
            enable={!!tapeFile}
            clicked={async () => {
              await mainApi.reloadTapeFile();
              await emuApi.issueMachineCommand("rewind");
            }}
          />
        </ToolbarGroup>
      )}
      {recordingAvailable && (
        <ToolbarGroup id="record" priority={20} separator overflowItems={recordItems}>
          <ToolbarSplitAction
            iconName="record-start"
            fill={
              recIdle
                ? undefined
                : recState === "armed"
                  ? "#ffd700"
                  : recState === "recording"
                    ? "#ff4444"
                    : "#ff8800"
            }
            selected={recState === "recording" || recState === "armed"}
            title={
              recIdle
                ? t("toolbar.record.start")
                : recState === "armed"
                  ? t("toolbar.record.armed")
                  : recState === "recording"
                    ? t("toolbar.record.recording")
                    : t("toolbar.record.paused")
            }
            clicked={
              recIdle
                ? () => recordingManagerRef?.current?.arm(undefined, isRunning)
                : () => recordingManagerRef?.current?.disarm()
            }
            dropdownTitle={t("toolbar.record.menu")}
            dropdownClicked={(e) => recordMenuApi.showAt(e.currentTarget)}
          />
        </ToolbarGroup>
      )}
      {recordMenu.contextVisible && (
        <ContextMenu state={recordMenu} onClickOutside={recordMenuApi.conceal}>
          <ContextMenuItem
            text={windowRecording ? t("toolbar.record.stopIdeEmu") : t("toolbar.record.startIdeEmu")}
            disabled={!windowRecording && !recIdle}
            clicked={async () => {
              recordMenuApi.conceal();
              await toggleIdeEmuRecording();
            }}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            text={t("menu.machine.recordingSettings")}
            clicked={async () => {
              recordMenuApi.conceal();
              await openRecordingSettings();
            }}
          />
        </ContextMenu>
      )}
    </>
  );
};
