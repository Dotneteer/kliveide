import { useEffect, useMemo, useState } from "react";

import { useT, type TFunction } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

import { PanelHeaderGroup } from "@renderer/controls/data";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { AddressInput } from "@renderer/controls/AddressInput";
import { Text } from "@renderer/controls/layout/Text";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import {
  GRAPHIC_LAYOUTS,
  GRAPHIC_MASKS,
  GRAPHIC_ZOOMS,
  GRAPHICS_PRESETS,
  MAX_GRAPHIC_HEIGHT,
  MAX_GRAPHIC_WIDTH,
  normalizeLook,
  type GraphicLayout,
  type GraphicMask,
  type GraphicsLook,
  type GraphicZoom
} from "@common/reverse/graphicsDecode";
import styles from "./GraphicsView.module.scss";

/*
 * The graphics finder's toolbar (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.2): the look's
 * parameters, the presets, and Go to. A context group in the document's `PanelHeader`, as the
 * Sprites view's toolbar is.
 */

const LAYOUT_LABELS: Record<GraphicLayout, MessageKey> = {
  linear: "panels.graphics.layout.linear",
  cells: "panels.graphics.layout.cells",
  columns: "panels.graphics.layout.columns",
  screen: "panels.graphics.layout.screen"
};

/** The mask choices, shared with the Name graphic dialog */
export const MASK_LABELS: Record<GraphicMask, MessageKey> = {
  none: "panels.graphics.mask.none",
  interleaved: "panels.graphics.mask.interleaved",
  before: "panels.graphics.mask.before",
  after: "panels.graphics.mask.after"
};

const ZX_COLOUR_NAMES: readonly MessageKey[] = [
  "panels.graphics.colour.0",
  "panels.graphics.colour.1",
  "panels.graphics.colour.2",
  "panels.graphics.colour.3",
  "panels.graphics.colour.4",
  "panels.graphics.colour.5",
  "panels.graphics.colour.6",
  "panels.graphics.colour.7"
];

/** The option lists, in the current language */
function toolbarOptions(t: TFunction) {
  return {
    colours: Array.from({ length: 16 }, (_, i): DropdownOption => {
      const name = t(ZX_COLOUR_NAMES[i & 7]);
      return { value: String(i), label: i >= 8 ? t("panels.graphics.brightColour", { colour: name }) : name };
    }),
    layouts: GRAPHIC_LAYOUTS.map((value): DropdownOption => ({ value, label: t(LAYOUT_LABELS[value]) })),
    masks: GRAPHIC_MASKS.map((value): DropdownOption => ({ value, label: t(MASK_LABELS[value]) })),
    columns: [
      { value: "0", label: t("panels.graphics.fit") },
      ...[1, 2, 4, 8, 16, 32].map((n) => ({ value: String(n), label: String(n) }))
    ] as DropdownOption[]
  };
}

const zoomOptions: DropdownOption[] = GRAPHIC_ZOOMS.map((zoom) => ({ value: String(zoom), label: `${zoom}×` }));
// --- A function, read at render time: the preset names translate when read (`graphicsDecode.ts`)
const presetOptions = (): DropdownOption[] =>
  GRAPHICS_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }));

type Props = {
  look: GraphicsLook;
  decimalView?: boolean;
  /** Whether coverage is available to dim by; the switch says why not when it is not. */
  dimAvailable: boolean;
  onLookChange: (patch: Partial<GraphicsLook>) => void;
  onGoTo: (address: number) => void;
  onPreset: (id: string) => void;
};

export const GraphicsToolbar = ({
  look,
  decimalView = false,
  dimAvailable,
  onLookChange,
  onGoTo,
  onPreset
}: Props) => {
  const t = useT();
  const { colours: colourOptions, layouts: layoutOptions, masks: maskOptions, columns: columnOptions } = useMemo(
    () => toolbarOptions(t),
    [t]
  );
  const l = normalizeLook(look);
  const fixedShape = l.layout === "screen";
  return (
    <>
      <PanelHeaderGroup>
        <Text text={t("panels.graphics.width")} />
        <LabelSeparator />
        <Stepper
          ariaLabel={t("panels.graphics.widthLabel")}
          title={t("panels.graphics.widthTitle")}
          value={l.width}
          min={1}
          max={MAX_GRAPHIC_WIDTH}
          enabled={!fixedShape}
          onChange={(width) => onLookChange({ width })}
        />
        <Text text={t("panels.graphics.height")} />
        <LabelSeparator />
        <Stepper
          ariaLabel={t("panels.graphics.heightLabel")}
          title={t("panels.graphics.heightLabel")}
          value={l.height}
          min={1}
          max={MAX_GRAPHIC_HEIGHT}
          step={l.layout === "cells" ? 8 : 1}
          enabled={!fixedShape}
          onChange={(height) => onLookChange({ height })}
        />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Dropdown
          ariaLabel={t("panels.graphics.byteOrder")}
          options={layoutOptions}
          initialValue={l.layout}
          width={92}
          onChanged={(value) => onLookChange({ layout: value as GraphicLayout })}
        />
        <Dropdown
          ariaLabel={t("panels.graphics.mask")}
          options={maskOptions}
          initialValue={l.mask}
          width={110}
          onChanged={(value) => onLookChange({ mask: value as GraphicMask, showMask: false })}
        />
        {l.mask !== "none" && (
          <LabeledSwitch
            label={t("panels.graphics.showMask")}
            title={t("panels.graphics.showMaskTitle")}
            value={l.showMask}
            clicked={(showMask) => onLookChange({ showMask })}
          />
        )}
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text={t("panels.graphics.ink")} />
        <LabelSeparator />
        <Dropdown
          ariaLabel={t("panels.graphics.inkColour")}
          options={colourOptions}
          initialValue={String(l.ink)}
          width={120}
          onChanged={(value) => onLookChange({ ink: parseInt(value, 10) })}
        />
        <Text text={t("panels.graphics.paper")} />
        <LabelSeparator />
        <Dropdown
          ariaLabel={t("panels.graphics.paperColour")}
          options={colourOptions}
          initialValue={String(l.paper)}
          width={120}
          onChanged={(value) => onLookChange({ paper: parseInt(value, 10) })}
        />
        <LabeledSwitch
          label={t("panels.graphics.invert")}
          title={t("panels.graphics.invertTitle")}
          value={l.invert}
          clicked={(invert) => onLookChange({ invert })}
        />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text={t("panels.graphics.zoom")} />
        <LabelSeparator />
        <Dropdown
          ariaLabel={t("panels.graphics.zoom")}
          options={zoomOptions}
          initialValue={String(l.zoom)}
          width={56}
          onChanged={(value) => onLookChange({ zoom: parseInt(value, 10) as GraphicZoom })}
        />
        <Text text={t("panels.graphics.across")} />
        <LabelSeparator />
        <Dropdown
          ariaLabel={t("panels.graphics.acrossLabel")}
          options={columnOptions}
          initialValue={String(l.columns)}
          width={56}
          onChanged={(value) => onLookChange({ columns: parseInt(value, 10) })}
        />
        <LabeledSwitch
          label={t("panels.graphics.gaps")}
          title={t("panels.graphics.gapsTitle")}
          value={l.frameGap}
          clicked={(frameGap) => onLookChange({ frameGap })}
        />
        <span
          className={dimAvailable ? undefined : styles.disabledSwitch}
          title={
            dimAvailable
              ? t("panels.graphics.dimTitle")
              : t("panels.graphics.dimUnavailable")
          }
        >
          <LabeledSwitch
            label={t("panels.graphics.dimUnread")}
            value={dimAvailable && l.dimUnread}
            clicked={(dimUnread) => dimAvailable && onLookChange({ dimUnread })}
          />
        </span>
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Dropdown
          ariaLabel={t("panels.graphics.presets")}
          placeholder={t("panels.graphics.presets")}
          options={presetOptions()}
          width={150}
          onChanged={(value) => onPreset(value)}
        />
        <AddressInput label={t("panels.graphics.goTo")} clearOnEnter={true} decimalView={decimalView} onAddressSent={async (address) => onGoTo(address)} />
      </PanelHeaderGroup>
    </>
  );
};

/** A number with − and + beside it. */
const Stepper = ({
  ariaLabel,
  title,
  value,
  min,
  max,
  step = 1,
  enabled = true,
  onChange
}: {
  ariaLabel: string;
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  enabled?: boolean;
  onChange: (value: number) => void;
}) => {
  const t = useT();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const commit = () => {
    const parsed = parseInt(text.trim(), 10);
    if (Number.isNaN(parsed)) setText(String(value));
    else onChange(clamp(parsed));
  };
  return (
    <span className={styles.stepper} title={title}>
      <button
        type="button"
        className={styles.nudge}
        aria-label={t("panels.graphics.less", { name: ariaLabel })}
        disabled={!enabled || value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        −
      </button>
      <input
        className={styles.numberInput}
        aria-label={ariaLabel}
        spellCheck={false}
        disabled={!enabled}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          // --- The emulated machine listens on `window` while it runs.
          event.stopPropagation();
        }}
      />
      <button
        type="button"
        className={styles.nudge}
        aria-label={t("panels.graphics.more", { name: ariaLabel })}
        disabled={!enabled || value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        +
      </button>
    </span>
  );
};
