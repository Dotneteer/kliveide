// Available machine IDs
export const MI_SPECTRUM_48 = "sp48";
export const MI_SPECTRUM_128 = "sp128";
export const MI_SPECTRUM_3E = "spp3e";
export const MI_Z88 = "z88";
export const MI_ZXNEXT = "zxnext";
export const MI_C64 = "c64";
export const MI_ZX80 = "zx80";
export const MI_ZX81 = "zx81";

/**
 * The machines whose emulator screen can show the media strip (the tape and disk files in use),
 * switched by the `emuViewOptions.showMediaInfo` setting.
 */
export const MEDIA_INFO_MACHINE_IDS: string[] = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E];

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

// Available custom tool keys
export const CT_DISASSEMBLER = "disassembler";
export const CT_CUSTOM_DISASSEMBLER = "customDisassembler";
export const CT_DISASSEMBLER_VIEW = "disassemblyView";
