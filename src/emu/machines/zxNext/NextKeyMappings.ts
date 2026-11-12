import type { KeyMapping } from "@abstractions/KeyMapping";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { spectrumKeyMappings } from "@emu/machines/zxSpectrum/SpectrumKeyMappings";
import { NextExtraKeyCode } from "./nextKeyCodes";

/**
 * The Next's key names for host key mappings: the 40 matrix keys of the Spectrum (codes 0-39) and the
 * 16 extra membrane keys (codes 40-55, `NextExtraKeyCode`).
 */
export const NextKeyCodeSet: KeyCodeSet = { ...SpectrumKeyCode, ...NextExtraKeyCode };

/**
 * The Next's default host key mapping: the Spectrum's, except that the host keys standing for one of
 * the Next's extra keys press that extra key, not the two matrix keys a 48K owner would have pressed.
 *
 * The core then does what the membrane does (membrane.vhd `matrix_work_ex`): it sets the key's bit in
 * NextReg $B0 or $B1, and enters the matrix pair - UP as CAPS SHIFT + 7, `,` as SYMBOL SHIFT + N -
 * unless NextReg $68 bit 4 cancels those entries. Mapping the host's arrow straight to CAPS SHIFT + 7,
 * as the Spectrum does, left $B0/$B1 at 0 and $68 bit 4 without effect.
 */
export const nextKeyMappings: KeyMapping = {
  ...spectrumKeyMappings,
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Backspace: "Delete",
  Home: "Edit",
  Comma: "Comma",
  Period: "Period",
  NumpadDecimal: "Period",
  Semicolon: "Semicolon",
  Quote: "DoubleQuote"
};
