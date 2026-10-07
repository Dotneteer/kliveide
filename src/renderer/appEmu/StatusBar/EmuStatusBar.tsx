import { useMachineController } from "@renderer/core/useMachineController";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { CLOCK_MULTIPLIERS, clockMultiplierLabel } from "@common/machines/emulator-levels";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  MEDIA_INFO_MACHINE_IDS,
  MF_ALLOW_CLOCK_MULTIPLIER,
  MI_ZXNEXT
} from "@common/machines/constants";
import {
  SETTING_EMU_SHOW_MEDIA_INFO,
  SETTING_EMU_SHOW_NEXT_LAYERS,
  SETTING_EMU_SHOW_PERFORMANCE_INFO,
  SETTING_EMU_SHOW_STATUS_BAR
} from "@common/settings/setting-const";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Icon } from "@controls/Icon";
import { SpaceFiller } from "@controls/SpaceFiller";
import { FrameStats } from "@renderer/abstractions/FrameStats";
import classnames from "classnames";
import styles from "./EmuStatusBar.module.scss";
import { FrameCompletedArgs } from "@renderer/abstractions/IMachineController";

type EmuStatusBarProps = {
  show: boolean;
  /**
   * Whether to show the frame times, frame count and PC on the left (issue #1377). They are
   * debugging aids that change every few frames, which is noise to someone just using the machine.
   */
  showPerformanceInfo?: boolean;
}

export const EmuStatusBar = ({ show, showPerformanceInfo = true }: EmuStatusBarProps) => {
  const { machineService } = useAppServices();
  const controller = useMachineController();
  const [frameStats, setFrameStats] = useState<FrameStats>();
  const machineId = useSelector(s => s.emulatorState?.machineId);
  const [machineName, setMachineName] = useState("");
  const [freq, setFreq] = useState(0);
  const clockMultiplier = useSelector(s => s.emulatorState.clockMultiplier);
  /*
   * Selected only to re-render on a machine state change. PC is read from the machine at render time,
   * and frames re-render only some of the time (`onFrameCompleted`), so a pause - or a `.z88` snapshot
   * restored with no frame run at all - would otherwise leave the PC of an earlier frame on show.
   */
  useSelector(s => s.emulatorState?.machineState);
  const counter = useRef(0);
  const mainApi = useMainApi();
  const showMediaInfo = useGlobalSetting(SETTING_EMU_SHOW_MEDIA_INFO);
  const showNextLayers = useGlobalSetting(SETTING_EMU_SHOW_NEXT_LAYERS);
  const canMultiply =
    machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_ALLOW_CLOCK_MULTIPLIER] !== false;
  // --- The status bar's own parts are toggled from the status bar (`.plans/MENU_REDESIGN_PLAN.md` §5)
  const [barMenu, barMenuApi] = useContextMenuState();
  const [speedMenu, speedMenuApi] = useContextMenuState();
  const speedChip = useRef<HTMLButtonElement>(null);
  const toggle = (settingId: string, value: boolean) => async () => {
    barMenuApi.conceal();
    await mainApi.setGlobalSettingsValue(settingId, value);
  };

  // --- Read by the frame handler, which is subscribed once per controller: a ref keeps it current
  // --- without resubscribing, and lets it skip the re-render while nothing would show the stats.
  const statsVisible = useRef(false);
  statsVisible.current = show && showPerformanceInfo;

  const onFrameCompleted = (completed: FrameCompletedArgs) => {
    if (!statsVisible.current) return;
    if (!completed || counter.current++ % 10) {
      setFrameStats({ ...controller.frameStats });
    }
  };

  // --- Reflect controller changes
  useEffect(() => {
    if (machineId) {
      const info = machineService.getMachineInfo();
      setMachineName(info.model?.displayName ?? info.machine.displayName ?? "");
    }
    if (controller) {
      setFreq(controller.machine.baseClockFrequency * clockMultiplier);
      controller.frameCompleted.on(onFrameCompleted);
    }
    return () => {
      controller?.frameCompleted.off(onFrameCompleted);
    };
  }, [controller]);

  // --- Reflect clock multiplier changes
  useEffect(() => {
    if (controller?.machine) {
      setFreq(controller.machine.baseClockFrequency * clockMultiplier);
    }
  }, [clockMultiplier]);

  if (!show) return null;
  return (
    <div
      className={styles.statusBar}
      onContextMenu={(e) => {
        e.preventDefault();
        // --- Anchored to the bar, not the click: the menu opens upward, inside the window
        barMenuApi.showAt(e.currentTarget);
      }}
    >
      <div className={styles.sectionWrapper}>
        {showPerformanceInfo && (
          <>
            <Section>
              <Icon
                iconName='vm-running'
                width={16}
                height={16}
                fill='--color-statusbar-icon'
              />
              <LabelSeparator />
              <DataLabel value={frameStats?.lastFrameTimeInMs ?? 0.0} />
              <Label text='/' />
              <DataLabel value={frameStats?.avgFrameTimeInMs ?? 0.0} />
            </Section>
            <SectionSeparator />
            <Section>
              <Icon
                iconName='window'
                width={16}
                height={16}
                fill='--color-statusbar-icon'
              />
              <LabelSeparator />
              <DataLabel
                value={frameStats?.frameCount ?? 0}
                minimumFractionDigits={0}
                maximumFractionDigits={0}
                minimumIntegerDigits={1}
              />
            </Section>
            <SectionSeparator />
            <Section>
              <Label text='PC:' />
              <LabelSeparator />
              <Label
                text={(controller?.machine?.pc ?? 0)
                  .toString(16)
                  .toUpperCase()
                  .padStart(4, "0")}
                isMonospace={true}
              />
            </Section>
          </>
        )}
        <SpaceFiller />
        <RzxBadge />
        <button
          type="button"
          className={styles.chip}
          title="Select machine"
          onClick={async () => await mainApi.runUiAction("open-machine-selector")}
        >
          {machineName}
        </button>
        <LabelSeparator />
        {canMultiply ? (
          <button
            ref={speedChip}
            type="button"
            className={classnames(styles.chip, styles.isMonospace)}
            title="Speed"
            aria-haspopup="menu"
            onClick={() => speedMenuApi.showAt(speedChip.current)}
          >
            {`(${(freq / 1_000_000).toFixed(3)} MHz)`}
          </button>
        ) : (
          <Label text={`(${(freq / 1_000_000).toFixed(3)} MHz)`} />
        )}
      </div>
      {speedMenu.contextVisible && (
        <ContextMenu state={speedMenu} placement="top-end" onClickOutside={speedMenuApi.conceal}>
          {CLOCK_MULTIPLIERS.map((m) => (
            <ContextMenuItem
              key={m}
              text={clockMultiplierLabel(m)}
              selected={m === clockMultiplier}
              clicked={async () => {
                speedMenuApi.conceal();
                await mainApi.runUiAction("set:clockMultiplier", m);
              }}
            />
          ))}
        </ContextMenu>
      )}
      {barMenu.contextVisible && (
        <ContextMenu state={barMenu} placement="top-start" onClickOutside={barMenuApi.conceal}>
          <ContextMenuItem
            text="Show Performance Info"
            selected={showPerformanceInfo}
            clicked={toggle(SETTING_EMU_SHOW_PERFORMANCE_INFO, !showPerformanceInfo)}
          />
          {MEDIA_INFO_MACHINE_IDS.includes(machineId) && (
            <ContextMenuItem
              text="Show Media Information"
              selected={!!showMediaInfo}
              clicked={toggle(SETTING_EMU_SHOW_MEDIA_INFO, !showMediaInfo)}
            />
          )}
          {machineId === MI_ZXNEXT && (
            <ContextMenuItem
              text="Show the Layers Strip"
              selected={!!showNextLayers}
              clicked={toggle(SETTING_EMU_SHOW_NEXT_LAYERS, !showNextLayers)}
            />
          )}
          <ContextMenuSeparator />
          <ContextMenuItem text="Hide Status Bar" clicked={toggle(SETTING_EMU_SHOW_STATUS_BAR, false)} />
          <ContextMenuItem
            text="Emulator Settings..."
            clicked={async () => {
              barMenuApi.conceal();
              await mainApi.runUiAction("open-settings", "emulator");
            }}
          />
        </ContextMenu>
      )}
    </div>
  );
};

const Section = ({ children }: SectionProps) => {
  return <div className={styles.section}>{children}</div>;
};

type LabelProps = {
  text: string;
  isMonospace?: boolean;
};

const Label = ({ text, isMonospace }: LabelProps) => {
  return (
    <span
      className={classnames(styles.label, {
        [styles.isMonospace]: isMonospace
      })}
    >
      {text}
    </span>
  );
};

type SectionProps = {
  children: ReactNode;
};

type DataLabelProps = {
  value: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
};
const DataLabel = ({
  value,
  minimumFractionDigits = 3,
  maximumFractionDigits = 3,
  minimumIntegerDigits = 2
}: DataLabelProps) => {
  return (
    <Label
      text={value.toLocaleString(undefined, {
        minimumFractionDigits,
        maximumFractionDigits,
        minimumIntegerDigits
      })}
      isMonospace={true}
    />
  );
};

const LabelSeparator = () => <div className={styles.labelSeparator} />;
const SectionSeparator = () => <div className={styles.sectionSeparator} />;

/**
 * The RZX badge (`.plans/RZX_PLAN.md` §4.6): PLAY with the frame counter while a recording plays,
 * REC while one records, VIDEO while one renders, and REC in the warning colour while a stopped
 * recording waits to be saved. The colours are status tokens: state, not decoration.
 */
const RzxBadge = () => {
  const rzx = useSelector((s) => s.emulatorState?.rzx);
  if (!rzx || (rzx.mode === "idle" && !rzx.unsaved)) return null;
  const counter = rzx.frames ? `${rzx.frame}/${rzx.frames}` : `${rzx.frame}`;
  const [tag, cls, title] = rzx.unsaved
    ? ["REC", styles.rzxUnsaved, `The RZX recording stopped and is not saved: ${rzx.stopMessage ?? ""}`]
    : rzx.mode === "recording"
      ? ["REC", styles.rzxRecording, "Recording an RZX file"]
      : rzx.mode === "rendering"
        ? ["VIDEO", styles.rzxRendering, `Rendering ${rzx.file ?? "an RZX recording"} to video`]
        : ["PLAY", styles.rzxPlaying, `Playing ${rzx.file ?? "an RZX recording"}`];
  return (
    <>
      <div className={classnames(styles.section, styles.rzxBadge, cls)} title={title}>
        <span className={styles.rzxTag}>{tag}</span>
        <Label text={`RZX ${counter}`} isMonospace={true} />
      </div>
      <SectionSeparator />
    </>
  );
};
