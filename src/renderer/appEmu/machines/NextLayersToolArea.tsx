import classnames from "classnames";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { setNextLayersAction } from "@common/state/actions";
import type { NextLayerId, NextLayerViewState } from "@common/zxnext/layers/layerMix";
import { SETTING_EMU_SHOW_NEXT_LAYERS } from "@common/settings/setting-const";
import {
  closeLayerView,
  EMPTY_LAYER_VIEW,
  layerChips,
  priorityReadout,
  resetLayers,
  toggleHidden,
  toggleSolo,
  type LayerChip
} from "@common/zxnext/layers/layerView";
import { isZxNextIdeMachine } from "@emu/machines/zxNext/IZxNextIdeMachine";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";
import { Icon } from "@renderer/controls/Icon";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { reportMessagingError } from "@renderer/reportError";
import { useNextLayerRegs } from "@renderer/features/emulator/useNextLayerView";
import styles from "./NextLayersToolArea.module.scss";

/**
 * The ZX Spectrum Next Layers strip under the emulator screen (`.plans/LAYER_COMPOSITION_PLAN.md`
 * §4.5): the four layers as chips in the priority order `$15` selects now, re-ordered live, each
 * with hide and solo; then "show transparency", the clip outlines and the pixel probe, and the
 * priority mode. Everything here changes the one shared view in the app state (D4), which the
 * emulator applies to the machine's mixer and announces with a pill (D3).
 */
export const NextLayersToolArea = ({ machine }: { machine: IAnyMachine }) => {
  const dispatch = useDispatch();
  const mainApi = useMainApi();
  const view = useSelector((s) => s.emulatorState?.nextLayers) ?? EMPTY_LAYER_VIEW;
  const running = useSelector((s) => s.emulatorState?.machineState) === MachineControllerState.Running;
  const next = isZxNextIdeMachine(machine) ? machine : undefined;
  const state = useNextLayerRegs(next, true, running);
  const set = (v: NextLayerViewState) => dispatch(setNextLayersAction(v));
  const chips = layerChips(state?.regs, view);
  const readout = priorityReadout(state?.regs);
  const changed = view.hidden !== 0 || view.solo !== 0 || view.showTransparent;

  // --- Back to the composite picture, then hide the strip (View → Show Layers brings it back)
  const close = async () => {
    set(closeLayerView(view));
    try {
      await mainApi.setGlobalSettingsValue(SETTING_EMU_SHOW_NEXT_LAYERS, false);
    } catch (err) {
      reportMessagingError(`Hiding the Layers strip failed: ${err}`);
    }
  };

  return (
    <div className={styles.layersStrip} data-testid="next-layers-strip">
      <span className={styles.order} title="Layer priority ($15), top layer first">
        {readout ?? "-"}
      </span>
      {chips.map((chip) => (
        <LayerChipView
          key={chip.id}
          chip={chip}
          onHide={() => set(toggleHidden(view, chip.id))}
          onSolo={() => set(toggleSolo(view, chip.id))}
        />
      ))}
      <span className={styles.separator} />
      <ToggleButton
        icon="spr-checker"
        title="Show transparency: paint the pixels no layer covers in magenta"
        on={view.showTransparent}
        onClick={() => set({ ...view, showTransparent: !view.showTransparent })}
      />
      <ToggleButton
        icon="square-dashed"
        title="Show the four clip windows on the screen"
        on={!!view.showClips}
        onClick={() => set({ ...view, showClips: !view.showClips })}
      />
      <ToggleButton
        icon="crosshair"
        title="Pixel probe: pause, then point at a pixel to see which layer produced it and why"
        on={!!view.probe}
        onClick={() => set({ ...view, probe: !view.probe })}
      />
      <button
        type="button"
        className={styles.reset}
        disabled={!changed}
        title="Show every layer"
        onClick={() => set(resetLayers(view))}
      >
        All
      </button>
      <button
        type="button"
        className={styles.close}
        title="Show the composite picture (every layer) and hide this strip"
        aria-label="Close the Layers strip"
        onClick={close}
      >
        <Icon iconName="close" width={14} height={14} fill="--color-display" />
      </button>
    </div>
  );
};

const CHIP_CLASS: Record<NextLayerId, string> = {
  ula: styles.ula,
  tm: styles.tm,
  l2: styles.l2,
  spr: styles.spr
};

const LayerChipView = ({ chip, onHide, onSolo }: { chip: LayerChip; onHide: () => void; onSolo: () => void }) => {
  const off = chip.hidden || chip.eclipsed;
  return (
    <span
      className={classnames(styles.chip, CHIP_CLASS[chip.id], {
        [styles.off]: off,
        [styles.soloed]: chip.solo
      })}
      data-testid={`layer-chip-${chip.id}`}
    >
      <button
        type="button"
        className={styles.chipMain}
        aria-pressed={!chip.hidden}
        title={
          `${chip.hidden ? "Show" : "Hide"} ${chip.name}` +
          (chip.disabledByProgram ? " (the program has it switched off)" : "")
        }
        onClick={onHide}
      >
        <Icon iconName={chip.hidden ? "eye-off" : "eye"} width={12} height={12} fill="--color-display" />
        <span className={styles.dot} />
        <span className={classnames(styles.name, { [styles.programOff]: chip.disabledByProgram })}>{chip.name}</span>
      </button>
      <button
        type="button"
        className={styles.solo}
        aria-pressed={chip.solo}
        title={chip.solo ? `End solo: show every layer` : `Solo: show ${chip.name} alone, over a checker`}
        onClick={onSolo}
      >
        S
      </button>
    </span>
  );
};

const ToggleButton = ({ icon, title, on, onClick }: { icon: string; title: string; on: boolean; onClick: () => void }) => (
  <button
    type="button"
    className={classnames(styles.toggle, { [styles.on]: on })}
    aria-pressed={on}
    title={title}
    onClick={onClick}
  >
    <Icon iconName={icon} width={14} height={14} fill={on ? "--color-display-hilite" : "--color-display"} />
  </button>
);
