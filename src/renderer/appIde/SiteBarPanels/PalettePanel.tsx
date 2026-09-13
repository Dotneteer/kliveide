import { useCallback, useMemo, useState } from "react";
import classnames from "classnames";

import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import {
  getCssStringForPaletteCode,
  paletteCodeFromDeviceValue
} from "@emu/machines/zxNext/palette";
import { PaletteDeviceInfo } from "@common/messaging/EmuApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { Icon } from "@renderer/controls/Icon";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { DataPanel, EmptyState, SectionHeader } from "@renderer/controls/data";
import { iconSizes } from "@renderer/theming/tokens/dimensions";

import { useEmuStateListener } from "../useStateRefresh";
import styles from "./PalettePanel.module.scss";

/**
 * The four palette-owning devices, in the order the Next's own documentation lists them.
 *
 * This is a table rather than eight hand-written blocks because the *shape* is the point: a Next
 * device does not have two independent palettes, it has one palette with two banks and a register
 * bit that says which of them is live. The previous panel flattened that into eight peer entries
 * named "ULA first", "ULA second", ..., which threw away the pairing, the "one of these is the one
 * the machine is drawing with" fact, and the reason anyone opens this panel.
 */
type DeviceDef = {
  id: string;
  label: string;
  banks: [(info: PaletteDeviceInfo) => number[], (info: PaletteDeviceInfo) => number[]];
  /** Which bank the hardware is currently drawing from. */
  liveBank: (info: PaletteDeviceInfo) => 0 | 1;
  /** The register bit that decides it, for the bank control's tooltip. */
  liveSource: string;
  /**
   * The palette index this device treats as transparent, where that is an index at all.
   *
   * ULA and Layer 2 have none: Next Reg $14 is a global transparency *colour* matched against a
   * pixel's 8-bit value, not a palette slot, so there is no single entry to mark and marking an
   * arbitrary one would be a lie.
   */
  transparencyIndex?: (info: PaletteDeviceInfo) => number;
};

const DEVICES: DeviceDef[] = [
  {
    id: "ula",
    label: "ULA",
    banks: [(i) => i.ulaFirst, (i) => i.ulaSecond],
    liveBank: (i) => ((i.reg43Value ?? 0) & 0x02 ? 1 : 0),
    liveSource: "Reg $43, bit 1"
  },
  {
    id: "layer2",
    label: "Layer 2",
    banks: [(i) => i.layer2First, (i) => i.layer2Second],
    liveBank: (i) => ((i.reg43Value ?? 0) & 0x04 ? 1 : 0),
    liveSource: "Reg $43, bit 2"
  },
  {
    id: "sprites",
    label: "Sprites",
    banks: [(i) => i.spriteFirst, (i) => i.spriteSecond],
    liveBank: (i) => ((i.reg43Value ?? 0) & 0x08 ? 1 : 0),
    liveSource: "Reg $43, bit 3",
    transparencyIndex: (i) => i.spriteTransparencyIndex
  },
  {
    id: "tilemap",
    label: "Tilemap",
    banks: [(i) => i.tilemapFirst, (i) => i.tilemapSecond],
    liveBank: (i) => ((i.reg6bValue ?? 0) & 0x10 ? 1 : 0),
    liveSource: "Reg $6B, bit 4",
    transparencyIndex: (i) => i.tilemapTransparencyIndex
  }
];

const BANK_NAMES = ["First", "Second"] as const;

export const PalettePanel = () => {
  const emuApi = useEmuApi();
  const [paletteState, setPaletteState] = useState<PaletteDeviceInfo>(null);

  const refresh = useCallback(async () => {
    setPaletteState(await emuApi.getPalettedDeviceInfo());
  }, [emuApi]);

  useEmuStateListener(emuApi, refresh);

  if (!paletteState) {
    return (
      <DataPanel autoHeight xclass={styles.palettePanel}>
        <EmptyState message="No palette information" />
      </DataPanel>
    );
  }

  return (
    <DataPanel autoHeight xclass={styles.palettePanel}>
      {DEVICES.map((device) => (
        <DeviceSection key={device.id} device={device} info={paletteState} />
      ))}
    </DataPanel>
  );
};

type DeviceSectionProps = {
  device: DeviceDef;
  info: PaletteDeviceInfo;
};

const DeviceSection = ({ device, info }: DeviceSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  /**
   * Which bank is on screen.
   *
   * `null` means "whichever one is live" — and that is the default, because the question this panel
   * answers is "what is the machine drawing with". Picking a bank explicitly pins it, so a user
   * comparing the two does not have the view yanked out from under them the moment the program
   * flips the register. Nothing resets it back to following; the pin is the user's, and the live
   * marker stays visible on the other button the whole time.
   */
  const [pinnedBank, setPinnedBank] = useState<0 | 1 | null>(null);

  const liveBank = device.liveBank(info);
  const shownBank = pinnedBank ?? liveBank;
  const transparencyIndex = device.transparencyIndex?.(info);

  /*
   * The device stores straight 9-bit RGB333; `NextPaletteViewer` and every other palette consumer
   * in the app speak the register layout. Converting here, once per rendered bank, is the boundary
   * this panel owns — see the layout note at the top of `@emu/machines/zxNext/palette`. Feeding the
   * raw values straight through (which is what this panel used to do) rotated every colour by one
   * bit, so ULA blue `$005` drew as a dark teal and the whole sidebar disagreed with the emulator's
   * own screen.
   */
  const palette = useMemo(
    () => (device.banks[shownBank](info) ?? []).map(paletteCodeFromDeviceValue),
    [device, shownBank, info]
  );

  return (
    <div className={styles.device}>
      <SectionHeader xclass={styles.deviceHeader} clicked={() => setExpanded(!expanded)}>
        <Icon
          iconName="chevron-right"
          width={iconSizes.sm}
          height={iconSizes.sm}
          fill="--color-chevron"
          rotate={expanded ? 90 : 0}
        />
        <span className={styles.deviceName}>{device.label}</span>
        {/*
          * The always-on preview.
          *
          * This is why the panel is worth opening at all: the version before last showed eight
          * collapsed switches and nothing else, so a glance at the sidebar told you nothing about
          * the machine's colour state.
          */}
        <PaletteThumb palette={palette} />
        <span className={styles.bankSwitch} role="group" aria-label={`${device.label} palette bank`}>
          {([0, 1] as const).map((bank) => (
            <BankButton
              key={bank}
              bank={bank}
              device={device}
              isShown={shownBank === bank}
              isLive={liveBank === bank}
              clicked={() => setPinnedBank(bank)}
            />
          ))}
        </span>
      </SectionHeader>

      {expanded && (
        <div className={styles.deviceBody}>
          <NextPaletteViewer palette={palette} transparencyIndex={transparencyIndex} />
        </div>
      )}
    </div>
  );
};

type BankButtonProps = {
  bank: 0 | 1;
  device: DeviceDef;
  isShown: boolean;
  isLive: boolean;
  clicked: () => void;
};

/**
 * One half of the bank control.
 *
 * Two states on one 18px button. The fill says *what you are looking at*; the ring says *what the
 * machine is drawing with*.
 *
 * **The ring marks the exception, not the norm.** Shown follows live by default, so the two
 * coincide almost always — and in that case the ring is the same accent as the fill it sits under,
 * which is to say invisible: one clean chip. It only separates from the fill once the view is
 * pinned away from the hardware, which is exactly when it has something to say.
 *
 * This replaced a dot in the corner, which failed twice over. It was drawn in
 * `--text-on-accent` so as to be visible against the fill — `#0e0f11` in dark, i.e. a near-black
 * speck that read as dirt rather than as a marker — and it was *present on every device all the
 * time*, since the default state is the coinciding one. A mark that never varies is not a signal.
 */
const BankButton = ({ bank, device, isShown, isLive, clicked }: BankButtonProps) => {
  const ref = useTooltipRef<HTMLButtonElement>();
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={classnames(styles.bankButton, {
          [styles.bankShown]: isShown,
          [styles.bankLive]: isLive
        })}
        aria-pressed={isShown}
        aria-label={`${BANK_NAMES[bank]} palette${isLive ? " (live)" : ""}`}
        onClick={(e) => {
          // --- The header toggles the section; the bank control must not.
          e.stopPropagation();
          clicked();
        }}
      >
        {bank + 1}
      </button>
      <TooltipFactory
        refElement={ref.current}
        placement="bottom"
        content={
          `${BANK_NAMES[bank]} ${device.label} palette\n` +
          (isLive ? "Live — the machine is drawing with this bank\n" : "") +
          device.liveSource
        }
      />
    </>
  );
};

/**
 * The whole 16x16 palette as a 32px thumbnail, inline in the device row.
 *
 * **A miniature of the grid, not a summary of it.** This replaced a 2x128 gradient strip, which was
 * the wrong shape for the job in two ways the author named immediately: at ~1.7px per entry it
 * cannot show an individual colour, and on the ULA — whose palette repeats every 16 — the stripes
 * it did show were the *repeat period*, not anything about the colours. It read as texture. A
 * thumbnail of the real thing reads as a palette at a glance, and the ramp palettes show their
 * actual two-dimensional structure instead of four identical bands.
 *
 * 2px per entry, chosen against 1px and 3px: 1px still aliases a period-16 palette into texture,
 * and 3px makes a 52px row that starts competing with the grid it is a preview of.
 *
 * Sixteen elements, not 256: each row is one 16-stop hard gradient. The panel re-polls the emulator
 * on a timer, and four devices' worth of per-entry DOM would be a thousand nodes reconciled every
 * tick for something nobody clicks. Integer pixels per entry, so the mosaic lands on the pixel grid
 * — the same reason the grid itself is sized from its swatch.
 */
const PaletteThumb = ({ palette }: { palette: number[] }) => {
  const rows = useMemo(
    () => Array.from({ length: 16 }, (_, r) => gradientFor(palette, r * 16, r * 16 + 16)),
    [palette]
  );
  return (
    <span className={styles.thumb} aria-hidden="true">
      {rows.map((background, i) => (
        <i key={i} style={{ background }} />
      ))}
    </span>
  );
};

/** A hard-stop gradient covering `palette[from..to)`, one band per entry. */
function gradientFor(palette: number[], from: number, to: number): string {
  const count = to - from;
  const stops: string[] = [];
  for (let i = 0; i < count; i++) {
    const color = getCssStringForPaletteCode(palette[from + i] ?? 0);
    stops.push(`${color} ${((i / count) * 100).toFixed(3)}% ${(((i + 1) / count) * 100).toFixed(3)}%`);
  }
  return `linear-gradient(to right, ${stops.join(",")})`;
}
