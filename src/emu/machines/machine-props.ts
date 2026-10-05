export const FAST_LOAD = "FastLoad";
export const REWIND_REQUESTED = "RewindRequested";
export const TAPE_SAVER = "TapeSaver";
export const SAVED_TO_TAPE = "SavedToTape";
export const TAPE_MODE = "TapeMode";
export const DISK_A_WP = "DiskAWp";
export const DISK_B_WP = "DiskBWp";
export const DISK_A_CHANGES = "DiskAChanges";
export const DISK_B_CHANGES = "DiskBChanges";
/** The TR-DOS ROM file's path (the Pentagon's Beta 128), from the `SETTING_EMU_TRDOS_ROM` setting */
export const TRDOS_ROM_FILE = "TrdosRomFile";
/** The TC2048 ROM file's path, from the `SETTING_EMU_TC2048_ROM` setting (`.plans/TIMEX_SCORPION_PLAN.md` P5) */
export const TIMEX_ROM_FILE = "TimexRomFile";
/** The TC2068's and TS2068's 24K ROM files, from `SETTING_EMU_TC2068_ROM` / `SETTING_EMU_TS2068_ROM` */
export const TC2068_ROM_FILE = "Tc2068RomFile";
export const TS2068_ROM_FILE = "Ts2068RomFile";
/** A TR-DOS disk in drive A / B that the guest changed but that is not written back (an `.scl`) */
export const DISK_A_UNSAVED = "DiskAUnsaved";
export const DISK_B_UNSAVED = "DiskBUnsaved";
export const FILE_PROVIDER = "FileProvider";
export const AUDIO_SAMPLE_RATE = "AudioSampleRate";
export const BEEPER_SAMPLES = "BeeperSamples";