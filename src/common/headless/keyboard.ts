import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { runFrames, type FrameMachine } from "./frameRunner";

/*
 * Typing at an emulated keyboard without the emulator window (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md`
 * D15, T10). The Spectrum family (and the Next, whose matrix is the Spectrum's) types chords: each held
 * `hold` frames, then released for `gap` key-free frames, short of the ROM's auto-repeat delay and long
 * enough for its debounce - the timing the test harnesses use. The ZX80/ZX81 type through their own
 * key queue (`Zx8081WasmHost.typeText`, which knows their ROMs' debounce).
 *
 * What a letter types depends on the ROM's cursor mode, as on the real keyboard: in K mode `P` is PRINT.
 */

/** Frames a chord is held, and the key-free frames after it */
export const SPECTRUM_KEY_HOLD = 3;
export const SPECTRUM_KEY_GAP = 3;

/** The Symbol Shift characters of the Spectrum's keys */
const SYMBOL_SHIFT_KEYS: Record<string, string> = {
  "!": "N1",
  "@": "N2",
  "#": "N3",
  $: "N4",
  "%": "N5",
  "&": "N6",
  "'": "N7",
  "(": "N8",
  ")": "N9",
  _: "N0",
  "<": "R",
  ">": "T",
  ";": "O",
  '"': "P",
  "^": "H",
  "-": "J",
  "+": "K",
  "=": "L",
  ":": "Z",
  "£": "X",
  "?": "C",
  "/": "V",
  "*": "B",
  ",": "N",
  ".": "M"
};

/** Short names for the `{...}` key syntax */
const KEY_ALIASES: Record<string, string> = {
  CS: "CShift",
  CAPS: "CShift",
  SS: "SShift",
  SYM: "SShift",
  ENTER: "Enter",
  SPACE: "Space"
};

/** A Spectrum key's `SpectrumKeyCode` name, or `undefined` */
function spectrumKeyName(name: string): string | undefined {
  const trimmed = name.trim();
  const alias = KEY_ALIASES[trimmed.toUpperCase()];
  if (alias) return alias;
  if (/^[0-9]$/.test(trimmed)) return `N${trimmed}`;
  if (/^[a-z]$/i.test(trimmed)) return trimmed.toUpperCase();
  const known = Object.keys(SpectrumKeyCode).find((k) => k.toLowerCase() === trimmed.toLowerCase());
  return known;
}

/**
 * The key chords that type a text on a Spectrum: letters and digits are their keys, space and `\n`
 * are Space and Enter, the symbols are Symbol Shift with their key, and `{CS+5}` (or `{SShift+P}`,
 * `{ENTER}`) presses the named keys together.
 * @throws Error naming a character or key that cannot be typed
 */
export function spectrumChordsOf(text: string): string[][] {
  const chords: string[][] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      const end = text.indexOf("}", i + 1);
      if (end < 0) throw new Error(`An unclosed '{' in the keys at ${i + 1}.`);
      const names = text.slice(i + 1, end).split("+");
      const chord = names.map((name) => {
        const key = spectrumKeyName(name);
        if (!key) throw new Error(`Unknown key '${name}' in '{${text.slice(i + 1, end)}}'.`);
        return key;
      });
      chords.push(chord);
      i = end;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      chords.push(["Enter"]);
    } else if (ch === " ") {
      chords.push(["Space"]);
    } else if (/[0-9]/.test(ch)) {
      chords.push([`N${ch}`]);
    } else if (/[a-z]/i.test(ch)) {
      chords.push([ch.toUpperCase()]);
    } else if (SYMBOL_SHIFT_KEYS[ch]) {
      chords.push(["SShift", SYMBOL_SHIFT_KEYS[ch]]);
    } else {
      throw new Error(`The Spectrum keyboard cannot type '${ch}'; name the keys instead, e.g. {SS+P}.`);
    }
  }
  return chords;
}

/** The part of a Spectrum-family machine that typing needs */
export type SpectrumKeyboardMachine = FrameMachine & {
  setKeyStatus(key: number, isDown: boolean): void;
};

/** Types chords: each held `hold` frames and released for `gap` frames */
export function typeSpectrumChords(
  machine: SpectrumKeyboardMachine,
  chords: string[][],
  { hold = SPECTRUM_KEY_HOLD, gap = SPECTRUM_KEY_GAP }: { hold?: number; gap?: number } = {}
): void {
  for (const chord of chords) {
    const codes = chord.map((name) => {
      const code = SpectrumKeyCode[name];
      if (code === undefined) throw new Error(`Unknown Spectrum key '${name}'.`);
      return code;
    });
    for (const code of codes) machine.setKeyStatus(code, true);
    runFrames(machine, hold);
    for (const code of codes) machine.setKeyStatus(code, false);
    runFrames(machine, gap);
  }
}

/** The part of a ZX80/ZX81 that typing needs */
export type QueueTypingMachine = FrameMachine & {
  typeText(text: string, delayFrames?: number): void;
  getKeyQueueLength(): number;
};

/** Does the machine type through its own key queue (the ZX80/ZX81)? */
export function typesThroughQueue(machine: unknown): machine is QueueTypingMachine {
  return typeof (machine as QueueTypingMachine).typeText === "function";
}

/**
 * Types a text as keystrokes at the machine and runs until the last key is released and `settle`
 * key-free frames have passed
 * @throws Error for text the keyboard cannot type
 */
export function typeText(machine: SpectrumKeyboardMachine | QueueTypingMachine, text: string, settle = 4): void {
  if (typesThroughQueue(machine)) {
    machine.typeText(text);
    for (let i = 0; i < 20 * text.length + 50 && machine.getKeyQueueLength() > 0; i++) runFrames(machine, 1);
    runFrames(machine, settle);
    return;
  }
  typeSpectrumChords(machine, spectrumChordsOf(text));
}
