/*
 * The z88dk settings (`.plans/Z88DK_INTEGRATION_PLAN.md` §4.2, decision C6). The install is set up
 * through the Z88DK integration dialog; the build options live in `klive.project` and are read by
 * `Z88dkCompiler` through the settings reader (project settings win over user settings).
 */
export const Z88DK_ALL = "z88dk";

/** The install folder: `<root>/bin/zcc` and `<root>/lib/config`. */
export const Z88DK_INSTALL_FOLDER = "z88dk.root";

/** The version the dialog's test reported when the install was applied (`v23854-...`), metadata only. */
export const Z88DK_VERSION = "z88dk.version";

// --- Project build options (C6)

/** `sccz80` (default) or `sdcc`. */
export const Z88DK_COMPILER = "z88dk.compiler";
/** The C library: `classic` (default) or `new` (z88dk's newlib; `sdcc_ix`/`sdcc_iy` with SDCC). */
export const Z88DK_CLIB = "z88dk.clib";
/** A `-subtype=` override; the machine table picks one when it is empty. */
export const Z88DK_SUBTYPE = "z88dk.subtype";
/** A `-startup=` value (a number). */
export const Z88DK_STARTUP = "z88dk.startup";
/** The release build's optimisation: `none`, `O1`, `O2`, `O3`, `SO3` (default `O2`). */
export const Z88DK_OPTIMISE = "z88dk.optimise";
/** Extra zcc arguments, passed as they are, after Klive's own. */
export const Z88DK_EXTRA_ARGS = "z88dk.extraArgs";
/** Libraries to link: each becomes `-l<name>`. */
export const Z88DK_LIBS = "z88dk.libs";
/** `#pragma`-style definitions for every build: each becomes `-pragma-define:<item>`. */
export const Z88DK_PRAGMAS = "z88dk.pragmas";
/** Run `zcc -c` on the edited file for the editor's background diagnostics (off by default). */
export const Z88DK_BACKGROUND_CHECK = "z88dk.backgroundCheck";

/** The oldest z88dk build Klive supports (v2.4, decision C3; `.ai/z88dk/README.md`). */
export const Z88DK_MIN_SUPPORTED_BUILD = 23854;
/** The release tag of that build: the dialog marks this and newer releases as supported. */
export const Z88DK_MIN_SUPPORTED_TAG = "v2.4";

/**
 * The error code of "z88dk is not set up / not working": the IDE's build output follows the message
 * with a link that opens the z88dk integration dialog (`compile-code.ts`), keyed on this code, never
 * on the message's text.
 */
export const Z88DK_SETUP_ERROR_CODE = "ZCC-SETUP";

// --- The verdict the integration dialog shows next to a broken setup. Shared so a failed build says
// --- the same thing the dialog does, in the same words.
export const Z88DK_CONFIGURED_FAILED_MESSAGE = "The configured z88dk installation is missing or failed its test.";
