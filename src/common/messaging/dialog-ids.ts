// --- IDE dialogs
export const NEW_PROJECT_DIALOG = 1;
export const EXPORT_CODE_DIALOG = 2;
export const EXCLUDED_PROJECT_ITEMS_DIALOG = 3;
export const FIRST_STARTUP_DIALOG_IDE = 4;
export const ABOUT_DIALOG = 5;
export const SJASMPLUS_INTEGRATION_DIALOG = 6;
// --- Shown in whichever window has the focus, so both dialog registries render it (like ABOUT_DIALOG)
export const MACHINE_SELECT_DIALOG = 7;
// --- Shown in whichever window has the focus too (`.plans/MENU_REDESIGN_PLAN.md` §4)
export const SETTINGS_DIALOG = 8;
// --- Detect code and data (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4.6)
export const DETECT_CODE_DATA_DIALOG = 9;
// --- Boriel BASIC setup (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3.3). Both registries render it:
// --- the first-run offer appears in the emulator window, Settings opens it in the IDE window
export const BORIEL_SETUP_DIALOG = 10;
// --- z88dk (C) setup (`.plans/Z88DK_INTEGRATION_PLAN.md` §4), opened from Settings, `z88dk-setup` and a C build
export const Z88DK_INTEGRATION_DIALOG = 11;

// --- Emulator dialogs
export const EMU_DIALOG_BASE = 1000;
export const FIRST_STARTUP_DIALOG_EMU = EMU_DIALOG_BASE + 1;
export const CREATE_DISK_DIALOG = EMU_DIALOG_BASE + 2;
export const Z88_REMOVE_CARD_DIALOG = EMU_DIALOG_BASE + 3;
export const Z88_INSERT_CARD_DIALOG = EMU_DIALOG_BASE + 4;
export const Z88_EXPORT_CARD_DIALOG = EMU_DIALOG_BASE + 5;
export const Z88_CHANGE_RAM_DIALOG = EMU_DIALOG_BASE + 6;
export const JOYSTICK_BINDINGS_DIALOG = EMU_DIALOG_BASE + 7;
