import { describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import { parseSnaFile } from "@common/spectrum/snapshot/snaFile";
import { parseZ80File } from "@common/spectrum/snapshot/z80File";
import { parseSzxFile } from "@common/spectrum/snapshot/szxFile";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { buildSna128, buildSzx, buildZ80, state128, state48 } from "./builders";

/*
 * The snapshot viewer's file header and the load warnings in the pseudo-locale: every label, yes/no
 * value and warning is pseudo text. Register and port names (PC, Border, Port $7FFD) are the
 * deliberate exceptions: hardware names are never translated.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);
const isHardwareName = (label: string) => label === "PC" || label === "Border" || /^Port \$[0-9A-F]+$/.test(label);

describe("Spectrum snapshots in the pseudo-locale", () => {
  it("translates the header labels, the values and the warnings", () => {
    setLanguage("qps");
    const problems: string[] = [];
    const snapshots = [
      parseSnaFile(buildSna128(state128())),
      parseZ80File(
        buildZ80({ ...state48(), ay: { selected: 1, regs: new Array(16).fill(0) } }, {
          version: 3,
          hwMode: 1,
          ay48: true,
          issue2: true
        })
      ),
      parseSzxFile(buildSzx(state48(), { machineId: 1 }))
    ];
    for (const snapshot of snapshots) {
      for (const field of snapshot.header) {
        if (!isHardwareName(field.label) && !isPseudo(field.label)) problems.push(`label: ${field.label}`);
        if (/^(yes|no|on|off)$/.test(field.value)) problems.push(`value: ${field.value}`);
      }
      for (const warning of [...snapshot.warnings, ...mapSpectrumSnapshotToKlive(snapshot).warnings]) {
        if (!isPseudo(warning)) problems.push(`warning: ${warning}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
