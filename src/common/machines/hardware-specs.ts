/*
 * Static hardware facts of every registered machine model, for the Select Machine dialog's hardware
 * sheet (`.plans/MACHINE_SELECT_DIALOG_PLAN.md` §4.2, §5.1b).
 *
 * Why a table: most of these numbers live inside the machine hosts or the WASM C cores, and the
 * dialog must not instantiate a machine to read them. Three rules keep the table honest:
 *
 * 1. **Derive what the registry already says** - RAM from `MC_MEM_SIZE` / `MC_Z88_INTRAM`, banks from
 *    `MF_BANK`, the clock multiplier from `MF_ALLOW_CLOCK_MULTIPLIER`, PAL/NTSC from `MC_SCREEN_FREQ`,
 *    floppy drives from `MC_DISK_SUPPORT`, the Z88 ROM and keyboard from the model config. Those are
 *    resolved by `getHardwareSpec`, never written here.
 * 2. **Import a constant where a host exports one** (`ZX8081_*`, `Z88_*`).
 * 3. **Everything else is checked against the running cores** by `test/machines/hardware-specs*.test.ts`.
 *    A fact no source pins down (ZX81 lines per frame, the ZX80's line length) is left out and the
 *    sheet shows "—"; nothing here is written from memory.
 *
 * Texts (`.plans/LOCALIZATION_PLAN.md` D7): a plain string is a technical value shown as it is (chip,
 * CPU and product names, `4 MB`, `KERNAL`); a sentence or plain word is a `tx(key)` message, which
 * `getHardwareSpec` translates when the dialog reads the spec.
 *
 * Must stay free of emulator and renderer imports: it is read by the dialog in both windows.
 */
import type { MachineInfo } from "./info-types";
import { t, type MessageArgs } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import {
  MC_DISK_SUPPORT,
  MC_MEM_SIZE,
  MC_SCREEN_FREQ,
  MC_Z88_INTRAM,
  MC_Z88_KEYBOARD,
  MC_Z88_SLOT0,
  MC_ZX80_ROM8K,
  MF_ALLOW_CLOCK_MULTIPLIER,
  MF_BANK,
  MI_C64,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_SCORPION,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT,
  MI_HT1080Z,
  MI_TVC
} from "./constants";
import {
  ZX80_ROM,
  ZX81_ROM,
  ZX8081_BASE_CLOCK_FREQUENCY,
  ZX8081_TACTS_IN_FRAME_NTSC,
  ZX8081_TACTS_IN_FRAME_PAL
} from "@emu/machines/zx8081/zx8081MachineInfo";
import {
  Z88_BASE_CLOCK_FREQUENCY,
  Z88_TACTS_IN_FRAME,
  Z88_UI_FRAME_FREQUENCY
} from "@emu/machines/z88/z88MachineInfo";
import {
  HT1080Z_CLOCK_64,
  HT1080Z_CLOCK_S12,
  HT1080Z_LINES_PER_FRAME,
  HT1080Z_PIXEL_ASPECT,
  HT1080Z_SCREEN_HEIGHT,
  HT1080Z_SCREEN_WIDTH,
  HT1080Z_TACTS_IN_FRAME,
  HT1080Z_TACTS_PER_LINE
} from "@emu/machines/ht1080z/ht1080zMachineInfo";
import { HT1080Z_ROM_SETS, type Ht1080zRomSetId } from "@emu/machines/ht1080z/Ht1080zRoms";
import {
  TVC_CLOCK,
  TVC_LINES_PER_FRAME,
  TVC_PIXEL_ASPECT,
  TVC_SCREEN_HEIGHT,
  TVC_SCREEN_WIDTH,
  TVC_TACTS_IN_FRAME,
  TVC_TACTS_PER_LINE
} from "@emu/machines/tvc/tvcMachineInfo";
import { TVC_ROM_SETS, type TvcRomSetId } from "@emu/machines/tvc/TvcRoms";
import { getP3RomSet } from "@emu/machines/zxSpectrumP3e/p3RomSets";
import { TIMEX_MODELS_INFO } from "@emu/machines/timex/timexModels";
import { SP128_TIMINGS } from "@emu/machines/zxSpectrum128/sp128Timings";

/** A text of the table: a technical value kept verbatim, or a message translated on read */
type SpecText = string | { key: MessageKey; args?: MessageArgs };

/** A translated text of the table */
const tx = (key: MessageKey, args?: MessageArgs): SpecText => ({ key, args });

function text(value: SpecText): string;
function text(value: SpecText | undefined): string | undefined;
function text(value: SpecText | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : t(value.key, value.args);
}

/** One ROM image the machine loads */
export type RomImage = { id: string; kb: number; role?: string };

/** Frame timing, in the CPU's own clock unit */
export type FrameTiming = {
  unit: "T-states" | "cycles";
  perLine?: number;
  linesPerFrame?: number;
  perFrame?: number;
  /** Frames per second. Derived from the clock and `perFrame` when omitted. */
  frameHz?: number;
  /** A second refresh rate, e.g. the Z88 LCD's */
  displayHz?: number;
  note?: string;
};

/** The picture */
export type DisplaySpec = {
  kind: "crt" | "lcd";
  /** The bitmap/paper area */
  width: number;
  height: number;
  /** The visible raster, border included (equal to width/height for an LCD) */
  rasterWidth: number;
  rasterHeight: number;
  /** Says what the raster is when it is not "with border" */
  rasterLabel?: string;
  /**
   * A raster dot's width over its height (the machine's `getAspectRatio`); square when omitted. The
   * sheet's drawing uses it, so a raster of narrow dots is not drawn twice as wide.
   */
  pixelAspect?: number;
  /**
   * The same for the bitmap/paper size, when it counts other dots than the raster (the Next's paper
   * is 256 Spectrum pixels, its raster half-pixels); `pixelAspect` when omitted.
   */
  paperPixelAspect?: number;
  colours: string;
  attributes?: string;
  text?: string;
  layers?: string;
  videoChip?: string;
  otherSizes?: string;
};

/** A model's hardware facts, as the sheet shows them */
export type HardwareSpecEntry = {
  cpu: string;
  clockHz: number;
  turbo?: string;
  rom: RomImage[];
  /** RAM when the model config does not say (`MC_MEM_SIZE`, `MC_Z88_INTRAM`) */
  ramKb: number;
  bankKb?: number;
  addressSpace?: string;
  display: DisplaySpec;
  timing: FrameTiming;
  sound: string[];
  media: string[];
  /**
   * The short names of the media for the machine list's chips, in `media` order; a medium the
   * model lacks ("No floppy drive") has none
   */
  mediaChips: string[];
  input: { label: string; value: string }[];
};

/** A storage medium: the sheet's text and, unless the model lacks it, the chip's short name */
type Medium = { text: SpecText; chip?: SpecText };

type RomSource = { id: string; kb: number; role?: SpecText };

type DisplaySource = Omit<DisplaySpec, "rasterLabel" | "colours" | "attributes" | "text" | "layers" | "otherSizes"> & {
  rasterLabel?: SpecText;
  colours: SpecText;
  attributes?: SpecText;
  text?: SpecText;
  layers?: SpecText;
  otherSizes?: SpecText;
};

type TimingSource = Omit<FrameTiming, "note"> & { note?: SpecText };

/** What the table stores for a machine, optionally overridden per model */
type SpecSource = {
  cpu: string;
  clockHz: number;
  turbo?: SpecText;
  rom: RomSource[];
  ramKb: number;
  bankKb?: number;
  addressSpace?: SpecText;
  display: DisplaySource;
  timing: TimingSource;
  sound: SpecText[];
  media: Medium[];
  input: { label: SpecText; value: SpecText }[];
};

type Overrides = Partial<Omit<SpecSource, "display" | "timing">> & {
  display?: Partial<DisplaySource>;
  timing?: Partial<TimingSource>;
};

type MachineSpecs = { base: SpecSource; models?: Record<string, Overrides> };

const SPECTRUM_DISPLAY: DisplaySource = {
  kind: "crt",
  width: 256,
  height: 192,
  rasterWidth: 352,
  rasterHeight: 288,
  colours: tx("hardware.colours.spectrum"),
  attributes: tx("hardware.attributes.spectrum")
};
const KEYBOARD = tx("hardware.input.keyboard");
const BEEPER = tx("hardware.sound.beeper");
const TAPE_CHIP = tx("hardware.media.tape");
const SPECTRUM_KEYBOARD = [{ label: KEYBOARD, value: tx("hardware.keyboard.spectrum") }];
const SPECTRUM_TAPE: Medium = { text: tx("hardware.media.spectrumTape"), chip: TAPE_CHIP };
const BETA128_CHIP = tx("hardware.chip.beta128");

/** The TC2068 and TS2068: the TC2048 plus the EXROM, the chunk map, the AY and the cartridge */
function TIMEX_2068_SPECS(id: "tc2068" | "ts2068"): Overrides {
  const model = TIMEX_MODELS_INFO[id];
  return {
    rom: [
      { id, kb: 16, role: tx("hardware.rom.timexHome") },
      { id: `${id}-exrom`, kb: 8, role: tx("hardware.rom.timexExrom") }
    ],
    bankKb: 8,
    addressSpace: tx("hardware.addressSpace.timex2068"),
    timing: {
      perLine: model.tactsPerLine,
      linesPerFrame: model.linesPerFrame,
      perFrame: model.tactsPerFrame,
      note: model.ntsc ? tx("hardware.timing.timexNtsc") : tx("hardware.timing.timexPal")
    },
    sound: [BEEPER, tx("hardware.sound.ayTimex")],
    media: [SPECTRUM_TAPE, { text: tx("hardware.media.timexCartridge"), chip: tx("hardware.chip.cartridge") }],
    input: [...SPECTRUM_KEYBOARD, { label: tx("hardware.input.joysticks"), value: tx("hardware.joystick.timex2068") }]
  };
}

/** An HT-1080Z model's three ROMs: the BASIC, the extension, the character generator */
function ht1080zRoms(id: Ht1080zRomSetId): RomSource[] {
  const set = HT1080Z_ROM_SETS[id];
  return [
    { id: set.basic.name, kb: set.basic.size / 1024, role: tx("hardware.rom.htBasic") },
    { id: set.extension.name, kb: set.extension.size / 1024, role: tx("hardware.rom.htExtension") },
    { id: set.chargen.name, kb: set.chargen.size / 1024, role: tx("hardware.rom.characterSet") }
  ];
}

function tvcRoms(id: TvcRomSetId): RomSource[] {
  const set = TVC_ROM_SETS[id];
  return [
    { id: set.sysLow.name, kb: set.sysLow.size / 1024, role: tx("hardware.rom.tvcSys") },
    { id: set.sysHigh.name, kb: set.sysHigh.size / 1024, role: tx("hardware.rom.tvcSys") },
    { id: set.exth.name, kb: set.exth.size / 1024, role: tx("hardware.rom.tvcExth") }
  ];
}

const ZX8081_BASE: SpecSource = {
  cpu: "Zilog Z80",
  clockHz: ZX8081_BASE_CLOCK_FREQUENCY,
  rom: [{ id: ZX81_ROM, kb: 8 }],
  ramKb: 16,
  display: {
    kind: "crt",
    width: 256,
    height: 192,
    rasterWidth: 352,
    rasterHeight: 288,
    colours: tx("hardware.colours.monochrome"),
    text: tx("hardware.text.zx81")
  },
  timing: { unit: "T-states", perFrame: ZX8081_TACTS_IN_FRAME_PAL },
  sound: [],
  media: [{ text: tx("hardware.media.zx81Tape"), chip: TAPE_CHIP }],
  input: [{ label: KEYBOARD, value: tx("hardware.keyboard.zx8081") }]
};
const ZX8081_NTSC: Overrides = {
  display: { rasterHeight: 240 },
  timing: { perFrame: ZX8081_TACTS_IN_FRAME_NTSC }
};

/**
 * The table, keyed by machine ID. `""` is the key of a machine without models.
 */
export const HARDWARE_SPECS: Readonly<Record<string, MachineSpecs>> = {
  [MI_SPECTRUM_48]: {
    // --- ZxSpectrum48WasmHost.ts, sp48.c, CommonScreenDevice.ZxSpectrum48*ScreenConfiguration
    base: {
      cpu: "Zilog Z80",
      clockHz: 3_500_000,
      rom: [{ id: "sp48", kb: 16 }],
      ramKb: 48,
      display: SPECTRUM_DISPLAY,
      timing: { unit: "T-states", perLine: 224, linesPerFrame: 312, perFrame: 69_888 },
      sound: [BEEPER],
      media: [SPECTRUM_TAPE],
      input: SPECTRUM_KEYBOARD
    },
    models: {
      ntsc: {
        clockHz: 3_527_500,
        display: { rasterHeight: 240 },
        timing: { linesPerFrame: 264, perFrame: 59_136 }
      }
    }
  },
  [MI_SPECTRUM_128]: {
    // --- ZxSpectrum128WasmHost.ts, sp128.c
    base: {
      cpu: "Zilog Z80",
      clockHz: 3_546_900,
      rom: [
        { id: "sp128-0", kb: 16, role: tx("hardware.rom.editor128") },
        { id: "sp128-1", kb: 16, role: tx("hardware.rom.basic48") }
      ],
      ramKb: 128,
      bankKb: 16,
      display: { ...SPECTRUM_DISPLAY, rasterHeight: 287 },
      timing: { unit: "T-states", perLine: 228, linesPerFrame: 311, perFrame: 70_908 },
      sound: [BEEPER, "AY-3-8912 PSG"],
      media: [SPECTRUM_TAPE],
      input: SPECTRUM_KEYBOARD
    },
    models: {
      // --- sp128Timings.ts (the Pentagon's timing from the Next FPGA's Pentagon mode)
      pentagon: {
        clockHz: 3_500_000,
        timing: {
          perLine: 224,
          linesPerFrame: 320,
          perFrame: 71_680,
          note: tx("hardware.timing.pentagon")
        },
        // --- The Beta 128 (`.plans/BETA128_TRDOS_PLAN.md`): it boots the user's own TR-DOS ROM
        media: [SPECTRUM_TAPE, { text: tx("hardware.media.pentagonBeta"), chip: BETA128_CHIP }]
      }
    }
  },
  [MI_TIMEX]: {
    // --- timexModels.ts, timex.c, zx-spectrum-scld.c (`.plans/TIMEX_SCORPION_PLAN.md` §8)
    base: {
      cpu: "Zilog Z80",
      clockHz: TIMEX_MODELS_INFO.tc2048.clockHz,
      rom: [{ id: "tc2048", kb: 16, role: tx("hardware.rom.tc2048") }],
      ramKb: 48,
      display: {
        ...SPECTRUM_DISPLAY,
        attributes: tx("hardware.attributes.timex"),
        otherSizes: tx("hardware.otherSizes.timex"),
        videoChip: "Timex SCLD"
      },
      timing: {
        unit: "T-states",
        perLine: TIMEX_MODELS_INFO.tc2048.tactsPerLine,
        linesPerFrame: TIMEX_MODELS_INFO.tc2048.linesPerFrame,
        perFrame: TIMEX_MODELS_INFO.tc2048.tactsPerFrame,
        note: tx("hardware.timing.timexPal")
      },
      sound: [BEEPER],
      media: [SPECTRUM_TAPE],
      input: [...SPECTRUM_KEYBOARD, { label: tx("hardware.input.joystick"), value: tx("hardware.joystick.timexKempston") }]
    },
    models: {
      tc2068: TIMEX_2068_SPECS("tc2068"),
      ts2068: {
        ...TIMEX_2068_SPECS("ts2068"),
        display: { rasterHeight: 240 }
      }
    }
  },
  [MI_SCORPION]: {
    // --- sp128Timings.ts (the Scorpion profile), sp128.c, ScorpionWasmV2Machine.ts (plan §8)
    base: {
      cpu: "Zilog Z80",
      clockHz: SP128_TIMINGS.scorpion.clockHz,
      rom: [
        { id: "scorpion-0", kb: 16, role: tx("hardware.rom.scorpionEditor") },
        { id: "scorpion-1", kb: 16, role: tx("hardware.rom.scorpionBasic") },
        { id: "scorpion-2", kb: 16, role: tx("hardware.rom.scorpionService") },
        { id: "scorpion-3", kb: 16, role: tx("hardware.rom.scorpionTrdos") }
      ],
      ramKb: 256,
      bankKb: 16,
      display: { ...SPECTRUM_DISPLAY, rasterHeight: 287 },
      timing: {
        unit: "T-states",
        perLine: SP128_TIMINGS.scorpion.tactsPerLine,
        linesPerFrame: SP128_TIMINGS.scorpion.linesPerFrame,
        perFrame: SP128_TIMINGS.scorpion.tactsPerFrame,
        note: tx("hardware.timing.scorpion")
      },
      sound: [BEEPER, "AY-3-8912 PSG"],
      media: [SPECTRUM_TAPE, { text: tx("hardware.media.scorpionBeta"), chip: BETA128_CHIP }],
      input: SPECTRUM_KEYBOARD
    }
  },
  [MI_SPECTRUM_3E]: {
    // --- ZxSpectrumP3eWasmHost.ts, spp3e.c
    base: {
      cpu: "Zilog Z80",
      clockHz: 3_546_900,
      rom: [0, 1, 2, 3].map((page) => ({ id: `spp3e-${page}`, kb: 16 })),
      ramKb: 128,
      bankKb: 16,
      display: { ...SPECTRUM_DISPLAY, rasterHeight: 287 },
      timing: { unit: "T-states", perLine: 228, linesPerFrame: 311, perFrame: 70_908 },
      sound: [BEEPER, "AY-3-8912 PSG"],
      media: [SPECTRUM_TAPE],
      input: SPECTRUM_KEYBOARD
    }
  },
  [MI_ZXNEXT]: {
    // --- ZxNextWasmHost.ts, ZxNextWasmV2Machine.ts (ROMs), zxnext.c (timing), nextMemoryLayout.ts
    base: {
      cpu: "Z80N",
      clockHz: 3_500_000,
      turbo: tx("hardware.turbo.next"),
      rom: [
        { id: "enNextZX", kb: 64, role: tx("hardware.rom.nextRoms") },
        { id: "enAltZX", kb: 32, role: tx("hardware.rom.alternative") },
        { id: "enNxtmmc", kb: 8, role: "DivMMC" },
        { id: "enNextMf", kb: 8, role: "Multiface" }
      ],
      ramKb: 1792,
      bankKb: 8,
      display: {
        kind: "crt",
        width: 256,
        height: 192,
        rasterWidth: 720,
        rasterHeight: 288,
        // --- The output buffer is in half-pixels (ZxNextWasmV2Machine's getAspectRatio); the paper in pixels
        pixelAspect: 0.5,
        paperPixelAspect: 1,
        rasterLabel: tx("hardware.raster.outputBuffer"),
        colours: tx("hardware.colours.next"),
        layers: tx("hardware.layers.next")
      },
      timing: {
        unit: "T-states",
        note: tx("hardware.timing.next")
      },
      sound: [BEEPER, "TurboSound (3 × AY)", tx("hardware.sound.nextDac")],
      media: [{ text: tx("hardware.media.sdCard"), chip: tx("hardware.chip.sdCard") }],
      input: [
        { label: KEYBOARD, value: tx("hardware.keyboard.next") },
        { label: tx("hardware.input.mouse"), value: "Kempston" },
        { label: tx("hardware.input.joysticks"), value: tx("hardware.joystick.nextPorts") }
      ]
    }
  },
  [MI_Z88]: {
    // --- z88MachineInfo.ts, z88-screen.c, z88-memory.c
    base: {
      cpu: "Zilog Z80",
      clockHz: Z88_BASE_CLOCK_FREQUENCY,
      rom: [],
      ramKb: 32,
      bankKb: 16,
      addressSpace: "4 MB",
      display: {
        kind: "lcd",
        width: 640,
        height: 64,
        rasterWidth: 640,
        rasterHeight: 64,
        colours: tx("hardware.colours.monochromeLcd"),
        attributes: tx("hardware.attributes.z88"),
        otherSizes: tx("hardware.otherSizes.z88")
      },
      timing: {
        unit: "T-states",
        perFrame: Z88_TACTS_IN_FRAME,
        displayHz: Z88_BASE_CLOCK_FREQUENCY / Z88_TACTS_IN_FRAME / Z88_UI_FRAME_FREQUENCY
      },
      sound: [BEEPER],
      media: [{ text: tx("hardware.media.z88Cards"), chip: tx("hardware.chip.z88Cards") }],
      input: []
    }
  },
  [MI_ZX81]: {
    base: ZX8081_BASE,
    models: { "zx81-16k-us": ZX8081_NTSC, "zx81-1k-us": ZX8081_NTSC }
  },
  [MI_HT1080Z]: {
    // --- ht1080zMachineInfo.ts, Ht1080zRoms.ts, wasm/ht1080z/ht1080z.c (`.plans/HT1080Z_PLAN.md`).
    // --- Series II is the base; the other models override what differs (§4.3).
    base: {
      cpu: "Zilog Z80",
      clockHz: HT1080Z_CLOCK_S12,
      rom: ht1080zRoms("s2"),
      ramKb: 16,
      display: {
        kind: "crt",
        width: 384,
        height: 192,
        rasterWidth: HT1080Z_SCREEN_WIDTH,
        rasterHeight: HT1080Z_SCREEN_HEIGHT,
        pixelAspect: HT1080Z_PIXEL_ASPECT,
        colours: tx("hardware.colours.monochrome"),
        text: tx("hardware.text.ht1080z")
      },
      timing: {
        unit: "T-states",
        perLine: HT1080Z_TACTS_PER_LINE,
        linesPerFrame: HT1080Z_LINES_PER_FRAME,
        perFrame: HT1080Z_TACTS_IN_FRAME,
        note: tx("hardware.timing.ht1080z")
      },
      sound: [BEEPER, tx("hardware.sound.ayHt1080z")],
      media: [{ text: tx("hardware.media.ht1080zTape"), chip: TAPE_CHIP }],
      input: [{ label: KEYBOARD, value: tx("hardware.keyboard.ht1080z") }]
    },
    models: {
      "ht1080z-s1": { rom: ht1080zRoms("s1") },
      "ht1080z-64": { rom: ht1080zRoms("s64"), clockHz: HT1080Z_CLOCK_64, ramKb: 48 },
      "ht1080z-s1-48k": { rom: ht1080zRoms("s1"), ramKb: 48 },
      "ht1080z-s2-48k": { ramKb: 48 }
    }
  },
  [MI_TVC]: {
    // --- tvcMachineInfo.ts, TvcRoms.ts, wasm/tvc/tvc.c (`.plans/VIDEOTON_TVC_PLAN.md`)
    base: {
      cpu: "Zilog Z80",
      clockHz: TVC_CLOCK,
      rom: tvcRoms("12"),
      ramKb: 64,
      display: {
        kind: "crt",
        width: 512,
        height: 240,
        rasterWidth: TVC_SCREEN_WIDTH,
        rasterHeight: TVC_SCREEN_HEIGHT,
        pixelAspect: TVC_PIXEL_ASPECT,
        colours: tx("hardware.colours.tvc"),
        text: tx("hardware.text.tvc")
      },
      timing: {
        unit: "T-states",
        perLine: TVC_TACTS_PER_LINE,
        linesPerFrame: TVC_LINES_PER_FRAME,
        perFrame: TVC_TACTS_IN_FRAME,
        note: tx("hardware.timing.tvc")
      },
      sound: [tx("hardware.sound.tvc")],
      media: [{ text: tx("hardware.media.tvcTape"), chip: TAPE_CHIP }],
      input: [{ label: KEYBOARD, value: tx("hardware.keyboard.tvc") }]
    },
    // --- The 64K+: BASIC 2.2 (and four 16K video banks, which the sheet has no row for)
    models: { tvc64p: { rom: tvcRoms("22") } }
  },
  [MI_ZX80]: {
    base: {
      ...ZX8081_BASE,
      rom: [{ id: ZX80_ROM, kb: 4 }],
      media: [{ text: tx("hardware.media.zx80Tape"), chip: TAPE_CHIP }],
      display: { ...ZX8081_BASE.display, text: tx("hardware.text.zx80") }
    }
  },
  [MI_C64]: {
    // --- C64Machine.ts, vic/vic-models.ts, C64VicDevice.ts
    base: {
      cpu: "MOS 6510",
      clockHz: 985_248,
      rom: [
        { id: "c64-basic", kb: 8, role: "BASIC" },
        { id: "c64-kernal-pal", kb: 8, role: "KERNAL" },
        { id: "c64-chargen", kb: 4, role: tx("hardware.rom.characterSet") }
      ],
      ramKb: 64,
      display: {
        kind: "crt",
        width: 320,
        height: 200,
        rasterWidth: 384,
        rasterHeight: 272,
        colours: "16",
        videoChip: "VIC-II MOS 6569R3"
      },
      timing: { unit: "cycles", perLine: 63, linesPerFrame: 312, perFrame: 19_656 },
      sound: ["SID"],
      media: [{ text: TAPE_CHIP, chip: TAPE_CHIP }],
      input: [{ label: KEYBOARD, value: "C64" }]
    },
    models: {
      ntsc: {
        clockHz: 1_022_727,
        rom: [
          { id: "c64-basic", kb: 8, role: "BASIC" },
          { id: "c64-kernal-ntsc", kb: 8, role: "KERNAL" },
          { id: "c64-chargen", kb: 4, role: tx("hardware.rom.characterSet") }
        ],
        display: { rasterHeight: 247, videoChip: "VIC-II MOS 8562" },
        timing: { perLine: 65, linesPerFrame: 263, perFrame: 17_095 }
      }
    }
  }
};

const Z88_KEYBOARD_NAMES: Record<string, MessageKey> = {
  uk: "hardware.keyboard.layout.uk",
  de: "hardware.keyboard.layout.de",
  fr: "hardware.keyboard.layout.fr",
  es: "hardware.keyboard.layout.es",
  it: "hardware.keyboard.layout.it",
  dk: "hardware.keyboard.layout.dk",
  se: "hardware.keyboard.layout.se"
};

function romImage(rom: RomSource): RomImage {
  return rom.role === undefined ? { id: rom.id, kb: rom.kb } : { id: rom.id, kb: rom.kb, role: text(rom.role) };
}

/** Removes the optional fields the model lacks, so a spec compares equal to a literal */
function dropUndefined(obj: object): void {
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) delete record[key];
  }
}

/** A model's hardware facts, with everything the registry knows resolved in */
export type HardwareSpec = HardwareSpecEntry & {
  machineId: string;
  modelId?: string;
  standard: "PAL" | "NTSC" | "LCD" | "PAL/NTSC";
  clockMultiplier: boolean;
  bankCount?: number;
};

/**
 * The hardware facts of a model.
 * @param machine The registry entry of the machine
 * @param modelId The (canonical) model ID; omitted for a machine without models
 * @returns undefined when the table has no entry for the machine
 */
export function getHardwareSpec(machine: MachineInfo, modelId?: string): HardwareSpec | undefined {
  const entry = HARDWARE_SPECS[machine.machineId];
  if (!entry) return undefined;
  const model = modelId ? machine.models?.find((m) => m.modelId === modelId) : undefined;
  if (modelId && !model) return undefined;
  const config = { ...(machine.config ?? {}), ...(model?.config ?? {}) };
  const over = (modelId && entry.models?.[modelId]) || {};

  const { display: _display, timing: _timing, ...rest } = over;
  const source: SpecSource = { ...entry.base, ...rest };
  const display: DisplaySource = { ...entry.base.display, ...over.display };
  const timing: TimingSource = { ...entry.base.timing, ...over.timing };
  const media: Medium[] = [...source.media];

  // --- Floppy drives (+3E)
  if (typeof config[MC_DISK_SUPPORT] === "number") {
    const drives = config[MC_DISK_SUPPORT];
    media.push(
      drives === 0
        ? { text: tx("hardware.media.noFloppy") }
        : drives === 1
          ? { text: tx("hardware.media.floppyA"), chip: tx("hardware.chip.floppyA") }
          : { text: tx("hardware.media.floppyAB"), chip: tx("hardware.chip.floppyAB") }
    );
  }

  // --- The texts in the current language
  const spec: HardwareSpecEntry = {
    cpu: source.cpu,
    clockHz: source.clockHz,
    turbo: text(source.turbo),
    rom: source.rom.map(romImage),
    ramKb: source.ramKb,
    bankKb: source.bankKb,
    addressSpace: text(source.addressSpace),
    display: {
      ...display,
      rasterLabel: text(display.rasterLabel),
      colours: text(display.colours),
      attributes: text(display.attributes),
      text: text(display.text),
      layers: text(display.layers),
      otherSizes: text(display.otherSizes)
    },
    timing: { ...timing, note: text(timing.note) },
    sound: source.sound.map((s) => text(s)),
    media: media.map((m) => text(m.text)),
    mediaChips: media.flatMap((m) => (m.chip === undefined ? [] : [text(m.chip)])),
    input: source.input.map((i) => ({ label: text(i.label), value: text(i.value) }))
  };
  dropUndefined(spec);
  dropUndefined(spec.display);
  dropUndefined(spec.timing);

  // --- RAM from the model configuration
  if (typeof config[MC_MEM_SIZE] === "number") spec.ramKb = config[MC_MEM_SIZE];
  if (typeof config[MC_Z88_INTRAM] === "number") spec.ramKb = (config[MC_Z88_INTRAM] + 1) * 16;

  // --- The ZX80 with the ZX81's 8K ROM
  if (config[MC_ZX80_ROM8K]) spec.rom = [{ id: ZX81_ROM, kb: 8 }];

  // --- The +2A/+3/+2E/+3E boots the model's ROM set (the +3E ROMs when the config does not say)
  if (machine.machineId === MI_SPECTRUM_3E) {
    const romId = getP3RomSet(config).romId;
    spec.rom = [0, 1, 2, 3].map((page) => ({ id: `${romId}-${page}`, kb: 16 }));
  }

  // --- The Z88's internal ROM sits in slot 0
  const slot0 = config[MC_Z88_SLOT0];
  if (slot0 && typeof slot0.file === "string") {
    spec.rom = [
      {
        id: slot0.file,
        kb: slot0.size,
        role: slot0.cardType === "ROM" ? "OZ" : t("hardware.rom.ozFlash", { cardType: slot0.cardType })
      }
    ];
  }
  if (machine.machineId === MI_Z88) {
    const layoutKey = Z88_KEYBOARD_NAMES[config[MC_Z88_KEYBOARD] ?? "uk"];
    const layout = layoutKey ? t(layoutKey) : String(config[MC_Z88_KEYBOARD]);
    spec.input = [{ label: t("hardware.input.keyboard"), value: t("hardware.keyboard.z88", { layout }) }];
  }

  const standard: HardwareSpec["standard"] =
    spec.display.kind === "lcd"
      ? "LCD"
      : machine.machineId === MI_ZXNEXT
        ? "PAL/NTSC"
        : config[MC_SCREEN_FREQ] === "ntsc"
          ? "NTSC"
          : "PAL";

  // --- Frames per second follow from the clock; a machine whose timing depends on its video mode
  // --- (the Next) has none
  const frameHz =
    spec.timing.frameHz ?? (spec.timing.perFrame ? spec.clockHz / spec.timing.perFrame : undefined);

  const banks = machine.features?.[MF_BANK];
  return {
    ...spec,
    machineId: machine.machineId,
    modelId: model?.modelId,
    standard,
    clockMultiplier: machine.features?.[MF_ALLOW_CLOCK_MULTIPLIER] !== false,
    // --- Only a model with paged memory (a bank size) has banks: the Timex machine declares the
    // --- 2068s' chunks, which the TC2048 lacks
    bankCount: typeof banks === "number" && spec.bankKb ? banks : undefined,
    timing: { ...spec.timing, frameHz }
  };
}
