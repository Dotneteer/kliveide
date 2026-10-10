import { useEffect, useState } from "react";

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

const LAYOUT_LABELS: Record<GraphicLayout, string> = {
  linear: "Linear",
  cells: "Cells",
  columns: "Columns",
  screen: "Screen"
};

const MASK_LABELS: Record<GraphicMask, string> = {
  none: "No mask",
  interleaved: "Interleaved",
  before: "Mask before",
  after: "Mask after"
};

const ZX_COLOUR_NAMES = ["Black", "Blue", "Red", "Magenta", "Green", "Cyan", "Yellow", "White"];

const colourOptions: DropdownOption[] = Array.from({ length: 16 }, (_, i) => ({
  value: String(i),
  label: `${i >= 8 ? "Bright " : ""}${ZX_COLOUR_NAMES[i & 7]}`
}));

const layoutOptions: DropdownOption[] = GRAPHIC_LAYOUTS.map((value) => ({ value, label: LAYOUT_LABELS[value] }));
const maskOptions: DropdownOption[] = GRAPHIC_MASKS.map((value) => ({ value, label: MASK_LABELS[value] }));
const zoomOptions: DropdownOption[] = GRAPHIC_ZOOMS.map((zoom) => ({ value: String(zoom), label: `${zoom}×` }));
const columnOptions: DropdownOption[] = [
  { value: "0", label: "Fit" },
  ...[1, 2, 4, 8, 16, 32].map((n) => ({ value: String(n), label: String(n) }))
];
const presetOptions: DropdownOption[] = GRAPHICS_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label
}));

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
  const l = normalizeLook(look);
  const fixedShape = l.layout === "screen";
  return (
    <>
      <PanelHeaderGroup>
        <Text text="Width" />
        <LabelSeparator />
        <Stepper
          ariaLabel="Bytes per pixel row"
          title="Bytes per pixel row (← / →)"
          value={l.width}
          min={1}
          max={MAX_GRAPHIC_WIDTH}
          enabled={!fixedShape}
          onChange={(width) => onLookChange({ width })}
        />
        <Text text="Height" />
        <LabelSeparator />
        <Stepper
          ariaLabel="Pixel rows per frame"
          title="Pixel rows per frame"
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
          ariaLabel="Byte order"
          options={layoutOptions}
          initialValue={l.layout}
          width={92}
          onChanged={(value) => onLookChange({ layout: value as GraphicLayout })}
        />
        <Dropdown
          ariaLabel="Mask"
          options={maskOptions}
          initialValue={l.mask}
          width={110}
          onChanged={(value) => onLookChange({ mask: value as GraphicMask, showMask: false })}
        />
        {l.mask !== "none" && (
          <LabeledSwitch
            label="Show mask"
            title="Show the mask plane instead of the pixels?"
            value={l.showMask}
            clicked={(showMask) => onLookChange({ showMask })}
          />
        )}
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text="Ink" />
        <LabelSeparator />
        <Dropdown
          ariaLabel="Ink colour"
          options={colourOptions}
          initialValue={String(l.ink)}
          width={120}
          onChanged={(value) => onLookChange({ ink: parseInt(value, 10) })}
        />
        <Text text="Paper" />
        <LabelSeparator />
        <Dropdown
          ariaLabel="Paper colour"
          options={colourOptions}
          initialValue={String(l.paper)}
          width={120}
          onChanged={(value) => onLookChange({ paper: parseInt(value, 10) })}
        />
        <LabeledSwitch
          label="Invert"
          title="Swap ink and paper?"
          value={l.invert}
          clicked={(invert) => onLookChange({ invert })}
        />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text="Zoom" />
        <LabelSeparator />
        <Dropdown
          ariaLabel="Zoom"
          options={zoomOptions}
          initialValue={String(l.zoom)}
          width={56}
          onChanged={(value) => onLookChange({ zoom: parseInt(value, 10) as GraphicZoom })}
        />
        <Text text="Across" />
        <LabelSeparator />
        <Dropdown
          ariaLabel="Frames side by side"
          options={columnOptions}
          initialValue={String(l.columns)}
          width={56}
          onChanged={(value) => onLookChange({ columns: parseInt(value, 10) })}
        />
        <LabeledSwitch
          label="Gaps"
          title="Leave a pixel between frames?"
          value={l.frameGap}
          clicked={(frameGap) => onLookChange({ frameGap })}
        />
        <span
          className={dimAvailable ? undefined : styles.disabledSwitch}
          title={
            dimAvailable
              ? "Dim the bytes the CPU never read: graphics are read data, so they stand out"
              : "Dimming needs coverage: turn it on with `coverage on`, run the program, then pause"
          }
        >
          <LabeledSwitch
            label="Dim unread"
            value={dimAvailable && l.dimUnread}
            clicked={(dimUnread) => dimAvailable && onLookChange({ dimUnread })}
          />
        </span>
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Dropdown
          ariaLabel="Presets"
          placeholder="Presets"
          options={presetOptions}
          width={150}
          onChanged={(value) => onPreset(value)}
        />
        <AddressInput label="Go to" clearOnEnter={true} decimalView={decimalView} onAddressSent={async (address) => onGoTo(address)} />
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
        aria-label={`${ariaLabel}: less`}
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
        aria-label={`${ariaLabel}: more`}
        disabled={!enabled || value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        +
      </button>
    </span>
  );
};
