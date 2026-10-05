/*
 * What dropping a file onto the emulator window does (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.10,
 * decision D10). The routing is by extension and is written to take more media types later:
 *  - `.sna`, `.z80`, `.szx`: run the snapshot (`zx-snapshot -r`), as File -> Load Snapshot... does;
 *  - `.z88`: open the Z88 snapshot as the Z88 menu does (`z88-snapshot -a`, following Autorun);
 *  - `.tap`, `.tzx`: insert the tape, as Select Tape File... does;
 *  - `.kls`: load the Klive state and debug it, stopping at its PC, as Load State... does;
 *  - `.rzx`: play the RZX recording (`zx-rzx`), as Play RZX Recording... does (`.plans/RZX_PLAN.md`);
 *  - anything else: refused with a message.
 */

import { spectrumSnapshotCommandText } from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";
import { z88SnapshotCommandText } from "@common/z88/z88SnapshotLoadTypes";
import { machineStateLoadCommandText } from "@common/machineState/machineStateTypes";
import { rzxPlayCommandText } from "@common/spectrum/rzx/rzxCommandTypes";

export type DroppedFileAction =
  | { kind: "command"; command: string }
  | { kind: "tape" }
  | { kind: "unsupported"; message: string };

/** The action for a dropped file's path */
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
    case "kls":
      return { kind: "command", command: machineStateLoadCommandText(path, "debug") };
    case "rzx":
      return { kind: "command", command: rzxPlayCommandText(path) };
    default:
      return {
        kind: "unsupported",
        message: `Klive cannot open ${ext ? `.${ext}` : "this kind of"} file by dropping it on the emulator. Drop a .sna, .z80, .szx or .z88 snapshot, a .kls machine state, an .rzx recording, or a .tap or .tzx tape.`
      };
  }
}
