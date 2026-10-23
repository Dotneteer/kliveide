/*
 * What opening a file in the emulator does: dropping it onto the emulator window
 * (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.10, decision D10) and File › Open File…
 * (`.plans/MENU_REDESIGN_PLAN.md` §3) both route here. The routing is by extension and is written to
 * take more media types later:
 *  - `.sna`, `.z80`, `.szx`: run the snapshot (`zx-snapshot -r`);
 *  - `.z88`: open the Z88 snapshot (`z88-snapshot -a`, following Autorun);
 *  - `.tap`, `.tzx`: insert the tape, as Machine › Tape › Insert Tape... does;
 *  - `.cas`, `.cmd`: insert the HT-1080Z tape, on the HT-1080Z only (`.plans/HT1080Z_PLAN.md` §9);
 *  - `.bas`: by its content, which the main process reads (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D6):
 *    a tokenised HT-1080Z program goes in as an HT tape, BASIC source text opens in the IDE;
 *  - `.kls`: load the Klive state and debug it, stopping at its PC (`state-load -d`, asking before a
 *    load that needs `-y`);
 *  - `.rzx`: play the RZX recording (`zx-rzx`, `.plans/RZX_PLAN.md`);
 *  - `.klr`: open the debug recording (`debug-recording-load`, asking before opening only its end
 *    state, `.plans/DEBUG_SESSION_RECORDING_PLAN.md`);
 *  - anything else: refused with a message.
 */

import { spectrumSnapshotCommandText } from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";
import { z88SnapshotCommandText } from "@common/z88/z88SnapshotLoadTypes";
import { machineStateLoadCommandText } from "@common/machineState/machineStateTypes";
import { rzxPlayCommandText } from "@common/spectrum/rzx/rzxCommandTypes";
import { debugRecordingLoadCommandText } from "@common/debugRecording/debugRecordingTypes";
import { t } from "@common/i18n/i18n";

export type DroppedFileAction =
  | { kind: "command"; command: string }
  | { kind: "tape" }
  | { kind: "htTape" }
  | { kind: "basic" }
  | { kind: "state"; command: string }
  | { kind: "recording"; command: string }
  | { kind: "unsupported"; message: string };

/** The extensions `droppedFileAction` opens, for File › Open File…'s file filter */
export const EMULATOR_FILE_EXTENSIONS = ["sna", "z80", "szx", "z88", "kls", "klr", "rzx", "tap", "tzx", "cas", "cmd", "bas"];

/** The action for a dropped (or opened) file's path */
export function droppedFileAction(path: string): DroppedFileAction {
  const lower = path.toLowerCase();
  const ext = lower.includes(".") ? lower.substring(lower.lastIndexOf(".") + 1) : "";
  switch (ext) {
    case "sna":
    case "z80":
    case "szx":
      return { kind: "command", command: spectrumSnapshotCommandText(path, "run") };
    case "z88":
      return { kind: "command", command: z88SnapshotCommandText(path, "autorun") };
    case "tap":
    case "tzx":
      return { kind: "tape" };
    case "cas":
    case "cmd":
      return { kind: "htTape" };
    case "bas":
      return { kind: "basic" };
    case "kls":
      return { kind: "state", command: machineStateLoadCommandText(path, "debug") };
    case "rzx":
      return { kind: "command", command: rzxPlayCommandText(path) };
    case "klr":
      return { kind: "recording", command: debugRecordingLoadCommandText(path) };
    default:
      return {
        kind: "unsupported",
        message: ext ? t("messages.file.unsupportedExt", { ext }) : t("messages.file.unsupported")
      };
  }
}
