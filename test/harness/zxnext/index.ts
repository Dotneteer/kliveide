/*
 * ZX Spectrum Next test harness - the public surface. Import from here in tests:
 *
 *   import { createSession, ALL_CORES } from "../harness/zxnext";
 *
 * See README.md in this folder.
 */

// --- Scripting: drive one real machine (TS or WASM core) from a vitest test
export {
  NextTestSession,
  createSession,
  onEachCore,
  hex,
  READY_REG,
  READY_VALUE,
  type AudioSample,
  type Hotkey,
  type Program,
  type Registers,
  type RtcTime,
  type SessionOptions,
  type WritableRegisters
} from "./script/session";
export { MemorySdCard, SD_SECTOR_BYTES, type SdCardBacking } from "./script/sd-card";
export { type UartFrame, type UartIndex } from "./script/uart-peer";
export { type MouseButton, type MouseEvent } from "./script/mouse";
export { JOY_BUTTONS, type JoyButton, type JoySide } from "./script/joystick";
export { MATRIX_KEYS, NEXT_EXTRA_KEYS, type ExtraKey, type MatrixKey, type NextKey } from "./script/keys";

// --- Machines and low-level helpers
export { ALL_CORES, createCore, readNextRegDirect, runDisplayedFrame, type CoreName } from "./core/machines";
export { captureFrame, pixelHex, rowRuns, summarizeRows, type Frame, type RowRun } from "./core/frame";
export { frameHash, framePng } from "./core/capture";
export { compileNexFile, type CompiledNex } from "./core/compile-nex";
export { loadNexDirect, readNextReg, writeNextReg } from "./core/load-nex-direct";
export { copperLineToBufferRow, displayFileAddress, paperXToBufferX, waitHToBufferX } from "./core/beam";
export { next8ToHex, parseColor, rgb333ToHex, ULA_COLORS } from "./core/colors";
export { contactSheet, diffPng } from "./core/images";

// --- Declarative screen cases (test/visual/<suite>/<case>/)
export { evaluateProbe, diffFrames, type Probe, type Range } from "./cases/probes";
export { evaluateMotions, type MotionSpec } from "./cases/motion";
export { discoverCases, loadCase, selectCases, type CaseSpec, type LoadedCase } from "./cases/case";
export { runCase, type CaseResult, type CheckResult } from "./cases/run-case";
