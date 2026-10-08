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

/**
 * The machines whose emulator screen can show the media strip (the tape and disk files in use),
 * switched by the `emuViewOptions.showMediaInfo` setting.
 */
export const MEDIA_INFO_MACHINE_IDS: string[] = [
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_TIMEX,
  MI_SCORPION
];

/**
 * The machines with a raster beam the emulator can show on its paused screen
 * (`.plans/BEAM_POSITION_OVERLAY_PLAN.md`): the ZX Spectrum family and the Next. Not the Z88 (an LCD,
 * no beam), the ZX80/81 (a CPU-generated display) or the C64. The toolbar button and the View menu
 * item appear only for these.
 */
export const BEAM_POSITION_MACHINE_IDS: string[] = [
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_TIMEX,
  MI_SCORPION,
  MI_ZXNEXT
];

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

// Available custom tool keys
export const CT_DISASSEMBLER = "disassembler";
export const CT_CUSTOM_DISASSEMBLER = "customDisassembler";
export const CT_DISASSEMBLER_VIEW = "disassemblyView";
