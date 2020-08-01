import { SpectrumKeyCode } from "../../native/SpectrumKeyCode";

/**
 * Provides an association between JavaScript key codes and keys
 */
export enum KeyCode {
  Break = 0x03,
  Backspace = 0x08,
  Tab = 0x09,
  NumEqual = 0x0c,
  Enter = 0x0d,
  Shift = 0x10,
  Ctrl = 0x11,
  Alt = 0x12,
  Pause = 0x13,
  CapsLock = 0x14,
  Esc = 0x1b,
  Space = 0x20,
  PageUp = 0x21,
  PageDown = 0x22,
  End = 0x23,
  Home = 0x24,
  ArrowLeft = 0x25,
  ArrowUp = 0x26,
  ArrowRight = 0x27,
  ArrowDown = 0x28,
  Insert = 0x2d,
  Delete = 0x2e,
  D0 = 0x30,
  D1 = 0x31,
  D2 = 0x32,
  D3 = 0x33,
  D4 = 0x34,
  D5 = 0x35,
  D6 = 0x36,
  D7 = 0x37,
  D8 = 0x38,
  D9 = 0x39,
  A = 0x41,
  B = 0x42,
  C = 0x43,
  D = 0x44,
  E = 0x45,
  F = 0x46,
  G = 0x47,
  H = 0x48,
  I = 0x49,
  J = 0x4a,
  K = 0x4b,
  L = 0x4c,
  M = 0x4d,
  N = 0x4e,
  O = 0x4f,
  P = 0x50,
  Q = 0x51,
  R = 0x52,
  S = 0x53,
  T = 0x54,
  U = 0x55,
  V = 0x56,
  W = 0x57,
  X = 0x58,
  Y = 0x59,
  Z = 0x5a,
  OSLeft = 0x5b,
  OSRight = 0x5c,
  ContextMenu = 0x5d,
  N0 = 0x60,
  N1 = 0x61,
  N2 = 0x62,
  N3 = 0x63,
  N4 = 0x64,
  N5 = 0x65,
  N6 = 0x66,
  N7 = 0x67,
  N8 = 0x68,
  N9 = 0x69,
  NumMul = 0x6a,
  NumAdd = 0x6b,
  NumSubtr = 0x6d,
  NumDec = 0x6e,
  NumDiv = 0x6f,
  NumLock = 0x90,
  Semicolon = 0xba,
  Equal = 0xbb,
  Comma = 0xbc,
  Minus = 0xbd,
  Period = 0xbe,
  Backquote = 0xc0,
  NumComma = 0xc2,
  BracketLeft = 0xdb,
  Backslash = 0xdc,
  BracketRight = 0xdd,
  Quote = 0xde,
  NumEnter = 0x100,
}

/**
 * Describes a key mapping between the PC and the ZX Spectrum keyboard
 */
export class KeyMapping {
  /**
   * Initializes a key mapping
   * @param key PC keyboard key code
   * @param zxPrimary Primary (mandatory) ZX Spectrum key code
   * @param zxSecondary Optional secondary ZX Spectrum key code
   */
  constructor(
    public key: KeyCode,
    public zxPrimary: SpectrumKeyCode,
    public zxSecondary?: SpectrumKeyCode
  ) {}
}

// --- Define the Spectrum key and name associations
const _spKeys = new Map<string, SpectrumKeyCode>();
_spKeys.set("N0", SpectrumKeyCode.N0);
_spKeys.set("N1", SpectrumKeyCode.N1);
_spKeys.set("N2", SpectrumKeyCode.N2);
_spKeys.set("N3", SpectrumKeyCode.N3);
_spKeys.set("N4", SpectrumKeyCode.N4);
_spKeys.set("N5", SpectrumKeyCode.N5);
_spKeys.set("N6", SpectrumKeyCode.N6);
_spKeys.set("N7", SpectrumKeyCode.N7);
_spKeys.set("N8", SpectrumKeyCode.N8);
_spKeys.set("N9", SpectrumKeyCode.N9);

_spKeys.set("Q", SpectrumKeyCode.Q);
_spKeys.set("W", SpectrumKeyCode.W);
_spKeys.set("E", SpectrumKeyCode.E);
_spKeys.set("R", SpectrumKeyCode.R);
_spKeys.set("T", SpectrumKeyCode.T);
_spKeys.set("Y", SpectrumKeyCode.Y);
_spKeys.set("U", SpectrumKeyCode.U);
_spKeys.set("I", SpectrumKeyCode.I);
_spKeys.set("O", SpectrumKeyCode.O);
_spKeys.set("P", SpectrumKeyCode.P);

_spKeys.set("A", SpectrumKeyCode.A);
_spKeys.set("S", SpectrumKeyCode.S);
_spKeys.set("D", SpectrumKeyCode.D);
_spKeys.set("F", SpectrumKeyCode.F);
_spKeys.set("G", SpectrumKeyCode.G);
_spKeys.set("H", SpectrumKeyCode.H);
_spKeys.set("J", SpectrumKeyCode.J);
_spKeys.set("K", SpectrumKeyCode.K);
_spKeys.set("L", SpectrumKeyCode.L);
_spKeys.set("Enter", SpectrumKeyCode.Enter);

_spKeys.set("CShift", SpectrumKeyCode.CShift);
_spKeys.set("Z", SpectrumKeyCode.Z);
_spKeys.set("X", SpectrumKeyCode.X);
_spKeys.set("C", SpectrumKeyCode.C);
_spKeys.set("V", SpectrumKeyCode.V);
_spKeys.set("B", SpectrumKeyCode.B);
_spKeys.set("N", SpectrumKeyCode.N);
_spKeys.set("M", SpectrumKeyCode.M);
_spKeys.set("SShift", SpectrumKeyCode.SShift);
_spKeys.set("Space", SpectrumKeyCode.Space);

export const SpectrumKeyNames = _spKeys;

// --- Define PC key and name associations
const _pcKeys = new Map<string, KeyCode>();
_pcKeys.set("Break", KeyCode.Break);
_pcKeys.set("Backspace", KeyCode.Backspace);
_pcKeys.set("Tab", KeyCode.Tab);
_pcKeys.set("Enter", KeyCode.Enter);
_pcKeys.set("ShiftLeft", KeyCode.Shift);
_pcKeys.set("ShiftRight", KeyCode.Shift);
_pcKeys.set("Ctrl", KeyCode.Ctrl);
_pcKeys.set("AltRight", KeyCode.Alt);
_pcKeys.set("Pause", KeyCode.Pause);
_pcKeys.set("CapsLock", KeyCode.CapsLock);
_pcKeys.set("Esc", KeyCode.Esc);
_pcKeys.set("Space", KeyCode.Space);
_pcKeys.set("PageUp", KeyCode.PageUp);
_pcKeys.set("PageDown", KeyCode.PageDown);
_pcKeys.set("End", KeyCode.End);
_pcKeys.set("Home", KeyCode.Home);
_pcKeys.set("ArrowLeft", KeyCode.ArrowLeft);
_pcKeys.set("ArrowUp", KeyCode.ArrowUp);
_pcKeys.set("ArrowRight", KeyCode.ArrowRight);
_pcKeys.set("ArrowDown", KeyCode.ArrowDown);
_pcKeys.set("Insert", KeyCode.Insert);
_pcKeys.set("Delete", KeyCode.Delete);
_pcKeys.set("Digit0", KeyCode.D0);
_pcKeys.set("Digit1", KeyCode.D1);
_pcKeys.set("Digit2", KeyCode.D2);
_pcKeys.set("Digit3", KeyCode.D3);
_pcKeys.set("Digit4", KeyCode.D4);
_pcKeys.set("Digit5", KeyCode.D5);
_pcKeys.set("Digit6", KeyCode.D6);
_pcKeys.set("Digit7", KeyCode.D7);
_pcKeys.set("Digit8", KeyCode.D8);
_pcKeys.set("Digit9", KeyCode.D9);
_pcKeys.set("KeyA", KeyCode.A);
_pcKeys.set("KeyB", KeyCode.B);
_pcKeys.set("KeyC", KeyCode.C);
_pcKeys.set("KeyD", KeyCode.D);
_pcKeys.set("KeyE", KeyCode.E);
_pcKeys.set("KeyF", KeyCode.F);
_pcKeys.set("KeyG", KeyCode.G);
_pcKeys.set("KeyH", KeyCode.H);
_pcKeys.set("KeyI", KeyCode.I);
_pcKeys.set("KeyJ", KeyCode.J);
_pcKeys.set("KeyK", KeyCode.K);
_pcKeys.set("KeyL", KeyCode.L);
_pcKeys.set("KeyM", KeyCode.M);
_pcKeys.set("KeyN", KeyCode.N);
_pcKeys.set("KeyO", KeyCode.O);
_pcKeys.set("KeyP", KeyCode.P);
_pcKeys.set("KeyQ", KeyCode.Q);
_pcKeys.set("KeyR", KeyCode.R);
_pcKeys.set("KeyS", KeyCode.S);
_pcKeys.set("KeyT", KeyCode.T);
_pcKeys.set("KeyU", KeyCode.U);
_pcKeys.set("KeyV", KeyCode.V);
_pcKeys.set("KeyW", KeyCode.W);
_pcKeys.set("KeyX", KeyCode.X);
_pcKeys.set("KeyY", KeyCode.Y);
_pcKeys.set("KeyZ", KeyCode.Z);
_pcKeys.set("ContextMenu", KeyCode.ContextMenu);
_pcKeys.set("Numpad0", KeyCode.N0);
_pcKeys.set("Numpad1", KeyCode.N1);
_pcKeys.set("Numpad2", KeyCode.N2);
_pcKeys.set("Numpad3", KeyCode.N3);
_pcKeys.set("Numpad4", KeyCode.N4);
_pcKeys.set("Numpad5", KeyCode.N5);
_pcKeys.set("Numpad6", KeyCode.N6);
_pcKeys.set("Numpad7", KeyCode.N7);
_pcKeys.set("Numpad8", KeyCode.N8);
_pcKeys.set("Numpad9", KeyCode.N9);
_pcKeys.set("NumpadMultiply", KeyCode.NumMul);
_pcKeys.set("NumpadAdd", KeyCode.NumAdd);
_pcKeys.set("NumpadSubtract", KeyCode.NumSubtr);
_pcKeys.set("NumpadDecimal", KeyCode.NumDec);
_pcKeys.set("NumpadDivide", KeyCode.NumDiv);
_pcKeys.set("NumpadEnter", KeyCode.NumEnter);
_pcKeys.set("NumLock", KeyCode.NumLock);
_pcKeys.set("Semicolon", KeyCode.Semicolon);
_pcKeys.set("Equal", KeyCode.Equal);
_pcKeys.set("Comma", KeyCode.Comma);
_pcKeys.set("Minus", KeyCode.Minus);
_pcKeys.set("Period", KeyCode.Period);
_pcKeys.set("Backquote", KeyCode.Backquote);
_pcKeys.set("NumComma", KeyCode.NumComma);
_pcKeys.set("BracketLeft", KeyCode.BracketLeft);
_pcKeys.set("Backslash", KeyCode.Backslash);
_pcKeys.set("BracketRight", KeyCode.BracketRight);
_pcKeys.set("Quote", KeyCode.Quote);

export const pcKeyNames = _pcKeys;

const hunKeyMapping: KeyMapping[] = [
  new KeyMapping(KeyCode.D1, SpectrumKeyCode.N1),
  new KeyMapping(KeyCode.D2, SpectrumKeyCode.N2),
  new KeyMapping(KeyCode.D3, SpectrumKeyCode.N3),
  new KeyMapping(KeyCode.D4, SpectrumKeyCode.N4),
  new KeyMapping(KeyCode.D5, SpectrumKeyCode.N5),
  new KeyMapping(KeyCode.D6, SpectrumKeyCode.N6),
  new KeyMapping(KeyCode.D7, SpectrumKeyCode.N7),
  new KeyMapping(KeyCode.D8, SpectrumKeyCode.N8),
  new KeyMapping(KeyCode.D9, SpectrumKeyCode.N9),
  new KeyMapping(KeyCode.D0, SpectrumKeyCode.N0),

  new KeyMapping(KeyCode.N1, SpectrumKeyCode.N1),
  new KeyMapping(KeyCode.N2, SpectrumKeyCode.N2),
  new KeyMapping(KeyCode.N3, SpectrumKeyCode.N3),
  new KeyMapping(KeyCode.N4, SpectrumKeyCode.N4),
  new KeyMapping(KeyCode.N5, SpectrumKeyCode.N5),
  new KeyMapping(KeyCode.N6, SpectrumKeyCode.N6),
  new KeyMapping(KeyCode.N7, SpectrumKeyCode.N7),
  new KeyMapping(KeyCode.N8, SpectrumKeyCode.N8),
  new KeyMapping(KeyCode.N9, SpectrumKeyCode.N9),
  new KeyMapping(KeyCode.N0, SpectrumKeyCode.N0),

  new KeyMapping(KeyCode.Q, SpectrumKeyCode.Q),
  new KeyMapping(KeyCode.W, SpectrumKeyCode.W),
  new KeyMapping(KeyCode.E, SpectrumKeyCode.E),
  new KeyMapping(KeyCode.R, SpectrumKeyCode.R),
  new KeyMapping(KeyCode.T, SpectrumKeyCode.T),
  new KeyMapping(KeyCode.Y, SpectrumKeyCode.Y),
  new KeyMapping(KeyCode.U, SpectrumKeyCode.U),
  new KeyMapping(KeyCode.I, SpectrumKeyCode.I),
  new KeyMapping(KeyCode.O, SpectrumKeyCode.O),
  new KeyMapping(KeyCode.P, SpectrumKeyCode.P),

  new KeyMapping(KeyCode.A, SpectrumKeyCode.A),
  new KeyMapping(KeyCode.S, SpectrumKeyCode.S),
  new KeyMapping(KeyCode.D, SpectrumKeyCode.D),
  new KeyMapping(KeyCode.F, SpectrumKeyCode.F),
  new KeyMapping(KeyCode.G, SpectrumKeyCode.G),
  new KeyMapping(KeyCode.H, SpectrumKeyCode.H),
  new KeyMapping(KeyCode.J, SpectrumKeyCode.J),
  new KeyMapping(KeyCode.K, SpectrumKeyCode.K),
  new KeyMapping(KeyCode.L, SpectrumKeyCode.L),
  new KeyMapping(KeyCode.Enter, SpectrumKeyCode.Enter),
  new KeyMapping(KeyCode.NumEnter, SpectrumKeyCode.Enter),

  new KeyMapping(KeyCode.Shift, SpectrumKeyCode.CShift),
  new KeyMapping(KeyCode.Z, SpectrumKeyCode.Z),
  new KeyMapping(KeyCode.X, SpectrumKeyCode.X),
  new KeyMapping(KeyCode.C, SpectrumKeyCode.C),
  new KeyMapping(KeyCode.V, SpectrumKeyCode.V),
  new KeyMapping(KeyCode.B, SpectrumKeyCode.B),
  new KeyMapping(KeyCode.N, SpectrumKeyCode.N),
  new KeyMapping(KeyCode.M, SpectrumKeyCode.M),
  new KeyMapping(KeyCode.Space, SpectrumKeyCode.Space),
  new KeyMapping(KeyCode.Alt, SpectrumKeyCode.SShift),

  new KeyMapping(KeyCode.Comma, SpectrumKeyCode.SShift, SpectrumKeyCode.N),
  new KeyMapping(KeyCode.NumDec, SpectrumKeyCode.SShift, SpectrumKeyCode.M),
  new KeyMapping(KeyCode.Period, SpectrumKeyCode.SShift, SpectrumKeyCode.M),
  new KeyMapping(KeyCode.NumDiv, SpectrumKeyCode.SShift, SpectrumKeyCode.V),
  new KeyMapping(KeyCode.NumMul, SpectrumKeyCode.SShift, SpectrumKeyCode.B),
  new KeyMapping(KeyCode.NumAdd, SpectrumKeyCode.SShift, SpectrumKeyCode.K),
  new KeyMapping(KeyCode.NumSubtr, SpectrumKeyCode.SShift, SpectrumKeyCode.J),
  new KeyMapping(KeyCode.Backspace, SpectrumKeyCode.CShift, SpectrumKeyCode.N0),
  new KeyMapping(KeyCode.ArrowLeft, SpectrumKeyCode.CShift, SpectrumKeyCode.N5),
  new KeyMapping(KeyCode.ArrowDown, SpectrumKeyCode.CShift, SpectrumKeyCode.N6),
  new KeyMapping(KeyCode.ArrowUp, SpectrumKeyCode.CShift, SpectrumKeyCode.N7),
  new KeyMapping(
    KeyCode.ArrowRight,
    SpectrumKeyCode.CShift,
    SpectrumKeyCode.N8
  ),
  new KeyMapping(KeyCode.Home, SpectrumKeyCode.CShift, SpectrumKeyCode.N1),
];

/**
 * Default key mapping
 */
export const defaultKeyMapping = hunKeyMapping;

/**
 * The current key mappings
 */
export const currentKeyMappings = new Map<KeyCode, KeyMapping>();

/**
 * Resets key mappings back to default
 */
export function resetKeyMappings(): void {
  currentKeyMappings.clear();
  for (const mapping of defaultKeyMapping) {
    currentKeyMappings.set(mapping.key, mapping);
  }
}

resetKeyMappings();

/**
 * Represents an emulated keystroke
 */
export class EmulatedKeyStroke {
  /**
   * Creates a keystroke emulation record
   * @param startFrame Start frame counter (inclusive)
   * @param endFrame End frame counter (exclusive)
   * @param primaryKey Primary key to emulate
   * @param secondaryKey Optional secondary key to emulate
   */
  constructor(
    public startFrame: number,
    public endFrame: number,
    public primaryKey: SpectrumKeyCode,
    public secondaryKey?: SpectrumKeyCode
  ) {}
}
