/**
 * Defines mappings between the physical keyboard and virtual machine keyboard
 */
export type KeyMapping = Record<string, KeySet>;

/**
 * Defines a set of virtual machine keys that can be assigned to a virtual key.
 *
 * At most **two** keys: every machine presses a character as a primary key plus an optional
 * modifier (`NextKeyCode`'s `primaryCode` / `secondaryCode`, honoured by `ZxSpectrumBase`,
 * `Z88WasmHost` and `C64Machine`), and the Next's membrane holds its extra keys down
 * as exactly two matrix keys (`EXTRA_KEY_COMBOS`). A third simultaneous key has no meaning on any
 * of them — extended mode is a *latch* entered by a prior keystroke (`NextKeyCode.extMode`), not a
 * key held alongside the other two. `keymapping-parser.ts` has always rejected three-item lists, so
 * no user mapping file can contain one either.
 */
type KeySet = string | [string] | [string, string];

