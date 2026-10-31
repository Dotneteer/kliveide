// Available machine IDs
export const MI_SPECTRUM_48 = "sp48";
export const MI_SPECTRUM_128 = "sp128";
export const MI_SPECTRUM_3E = "spp3e";
export const MI_Z88 = "z88";
export const MI_ZXNEXT = "zxnext";
export const MI_C64 = "c64";
export const MI_ZX80 = "zx80";
export const MI_ZX81 = "zx81";
/** The Timex Computer 2048 (`.plans/TIMEX_SCORPION_PLAN.md`; the TC2068/TS2068 join as models) */
export const MI_TIMEX = "timex";
/** The Scorpion ZS-256 (`.plans/TIMEX_SCORPION_PLAN.md` G9.4c), on the 128K's core */
export const MI_SCORPION = "scorpion";
/** The HT-1080Z (`.plans/HT1080Z_PLAN.md`): Series I, Series II and the /64 as models */
export const MI_HT1080Z = "ht1080z";
/** The Videoton TV Computer (`.plans/VIDEOTON_TVC_PLAN.md`): the 64K and the 64K+ as models */
export const MI_TVC = "tvc";
/** The Enterprise 64/128 (`.plans/ENTERPRISE_PLAN.md`): the 128 and the 64 as models */
export const MI_ENTERPRISE = "ep";

/**
 * The machines whose emulator screen can show the media strip (the tape and disk files in use),
 * switched by the `emuViewOptions.showMediaInfo` setting.
 */
export const MEDIA_INFO_MACHINE_IDS: string[] = [
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_TIMEX,
  MI_SCORPION,
  MI_HT1080Z,
  MI_TVC
];

/**
 * The machines with a raster beam the emulator can show on its paused screen
 * (`.plans/BEAM_POSITION_OVERLAY_PLAN.md`): the ZX Spectrum family, the Next, the HT-1080Z, the TVC and the
 * Enterprise. Not
 * the Z88 (an LCD, no beam), the ZX80/81 (a CPU-generated display) or the C64. The toolbar button and the View menu
 * item appear only for these.
 */
export const BEAM_POSITION_MACHINE_IDS: string[] = [
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_TIMEX,
  MI_SCORPION,
  MI_ZXNEXT,
  MI_HT1080Z,
  MI_TVC,
  MI_ENTERPRISE
];

/**
 * The machines whose screen can lose its sync, so that a real television showed noise: the ZX81 in
 * FAST mode while a program runs, and the ZX80 whenever it computes. The TV noise setting applies
 * only to these.
 */
export const TV_NOISE_MACHINE_IDS: string[] = [MI_ZX80, MI_ZX81];

/**
 * The machines with a Sinclair ULA whose late timing and snow Klive emulates (the 16K, the 48K and the
 * 128K; `.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` Phases 4, 5). The Pentagon among the 128K's models
 * ignores both.
 */
export const ULA_TIMING_MACHINE_IDS: string[] = [MI_SPECTRUM_48, MI_SPECTRUM_128];

// Available machine configuration keys
export const MC_DISK_SUPPORT = "diskSupport";
export const MC_SCREEN_FREQ = "screenFreq";
export const MC_MEM_SIZE = "memSize";
export const MC_SCREEN_SIZE = "screenSize";
export const MC_Z88_INTROM = "intROM";
export const MC_Z88_USE_DEFAULT_ROM = "useDefaultRom";
export const MC_Z88_INTROM_SIZE = "intROMSize";
export const MC_Z88_INTRAM = "intRAM";
export const MC_Z88_SLOT0 = "slot0";
export const MC_Z88_SLOT1 = "slot1";
export const MC_Z88_SLOT2 = "slot2";
export const MC_Z88_SLOT3 = "slot3";
export const MC_Z88_KEYBOARD = "keyboard";
export const MC_SP48_ROM_FILE = "sp48RomFile";
/** ZX80 only: the 8K ZX81 ROM upgrade instead of the 4K ZX80 ROM */
export const MC_ZX80_ROM8K = "zx80Rom8K";
/**
 * +2A/+3/+2E/+3E only: the ROM set the machine boots (`p3RomSets.ts`): "plus3e" (the default when
 * absent, so projects and state files from before the Amstrad ROMs keep the +3E ROMs),
 * "amstrad40", "amstrad41" or "amstrad41es"
 */
export const MC_SP3_ROM_SET = "sp3RomSet";
/**
 * ZX Spectrum 128K only: the timing the core runs (`sp128Timings.ts`): "sp128" (the default when
 * absent, so projects and state files from before the Pentagon keep the 128K) or "pentagon"
 */
export const MC_SP128_TIMING = "sp128Timing";
/** Timex only: the model the core runs (`timexModels.ts`): "tc2048" */
export const MC_TIMEX_MODEL = "timexModel";
/** Scorpion only: the 128K core runs as the Scorpion ZS-256 */
export const MC_SCORPION = "scorpion";
/** HT-1080Z only: the model the core runs (`ht1080zMachineInfo.ts`): "s1", "s2" or "s64" */
export const MC_HT_MODEL = "htModel";
/** Videoton TVC only: the model the core runs (`tvcMachineInfo.ts`): "64" or "64p" */
export const MC_TVC_MODEL = "tvcModel";
/** The Videoton TVC's HBF floppy interface card in slot 0, with VT-DOS (true: plugged in) */
export const MC_TVC_HBF = "tvcHbf";
/** Enterprise only: the model the core runs (`epMachineInfo.ts`): "128" or "64" */
export const MC_EP_MODEL = "epModel";
/** Enterprise only: IS-BASIC in the cartridge slot (absent or true: plugged in; false boots the word processor) */
export const MC_EP_CARTRIDGE = "epCartridge";
/** Enterprise only: NICK's colour levels: "resistor" (absent: the board's DAC) or "linear" (the guide's formula) */
export const MC_EP_PALETTE = "epPalette";
/** Enterprise only: Klive's FILE: device ROM at segment 10h (absent or true: fitted) */
export const MC_EP_HOSTFS = "epHostFs";
/** Enterprise only: the EXDOS floppy interface card, with its EXDOS 1.3 ROM at segments 20h-21h (true: fitted) */
export const MC_EP_EXDOS = "epExdos";
/**
 * The 48K, the 128K (its own timing, not the Pentagon's or the Scorpion's) and the +2A/+3/+2E/+3E: a
 * DivMMC is connected (`.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md` C5). It boots the esxDOS ROM the
 * user names (`SETTING_EMU_ESXDOS_ROM`) from the SD card the SD card menu names.
 */
export const MC_DIVMMC = "divMmc";
/**
 * The 48K and the 128K (its own timing): a ZX Interface 1 is connected, with its Microdrives
 * (`.plans/MICRODRIVE_PLAN.md`). Never together with the DivMMC: both decode port $E7 (Q4).
 */
export const MC_INTERFACE1 = "interface1";

// Available machine config keys
export const MF_TAPE_SUPPORT = "tapeSupport";
export const MF_MOUSE_SUPPORT = "mouseSupport";
export const MF_JOYSTICK_SUPPORT = "joystickSupport";
export const MF_ROM = "rom";
export const MF_BANK = "bank";
export const MF_ULA = "ula";
export const MF_VIC = "vic";
export const MF_PSG = "psg";
export const MF_BLINK = "blink";
export const MF_Z80 = "z80Cpu";
export const MF_M6510 = "m6510Cpu";
export const MF_ALLOW_CLOCK_MULTIPLIER = "allowClockMultiplier";
export const MF_ALLOW_SCAN_LINES = "allowScanLines";
/**
 * Whether code can be injected straight into the machine's memory.
 *
 * Not every target can take code that way. A ZX Spectrum Next build is delivered as a `.nex` file
 * the machine loads for itself, so "inject into the paused machine" has no meaning there — which is
 * why the Next needed a special case in `injectCode` before this feature existed.
 *
 * Read with `?? true`, so a machine that does not mention it keeps the behaviour it has today; every
 * machine in the registry states it explicitly all the same, because the interesting answer is the
 * `false` and a reader should not have to infer the rest.
 *
 * This gates the *inject* operation only. Run and debug remain available on machines without it:
 * they deliver the code by whatever route the machine does support.
 */
export const MF_INJECT_SUPPORT = "injectSupport";
/**
 * Whether the machine records execution history in debug sessions
 * (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` D12): the Execution History document, its commands and
 * its menu item gate on this, not on a list of machine ids, so a core that starts recording lights
 * them up by setting it here.
 */
export const MF_EXEC_HISTORY = "execHistory";

/**
 * Whether the machine keeps a reverse-debugging timeline in debug sessions
 * (`.plans/REVERSE_DEBUGGING_PLAN.md` D19): set per core once it passes the journal-replay
 * determinism test (`test/wasm/reverse/journal-replay-determinism.test.ts`).
 */
export const MF_REVERSE_DEBUG = "reverseDebug";

/**
 * Whether the machine's core keeps an access profile: code coverage, the memory heat map and the
 * profiler's time (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D15). Debug -> Code Coverage, the
 * `coverage` commands, the editor strip, the disassembly cell and the memory view's Heat selector
 * gate on this; set per core once its mapping test passes (Phase 2).
 */
export const MF_PROFILE = "profile";

// Available custom tool keys
export const CT_DISASSEMBLER = "disassembler";
export const CT_CUSTOM_DISASSEMBLER = "customDisassembler";
export const CT_DISASSEMBLER_VIEW = "disassemblyView";
