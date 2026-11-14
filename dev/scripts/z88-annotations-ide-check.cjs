#!/usr/bin/env node

/*
 * Z88 annotations in the running IDE (`dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`, Phase 1): the `z88`
 * bank space and the OZ ROM banks reported as ROM pages, end to end.
 *
 * Launches the built Klive under Playwright (`dev/scripts/doc-shots/harness.cjs`) with a throwaway home,
 * on the Z88 with OZ 4.7, boots it, pauses, and checks:
 *
 *   - a label in a ROM annotation working copy for z88v47.rom bank 0 binds on the running machine
 *     where bank 0 is paged: the live export of $C000-$C3FF names it at $C038 (bank 0 in segment 3),
 *     and $0000, where OZ keeps RAM bank $20, has no such label;
 *   - a bank breakpoint (`bp-set 00:+$0038`) is accepted on the Z88;
 *   - Export Disassembly as Source verifies (reassembles) over a range with OZ calls in it.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
 *   node dev/scripts/z88-annotations-ide-check.cjs
 *
 * Output (screenshots, the exported files, the throwaway home) goes to `.local/z88-annotations-ide-check/`.
 */

const fs = require("node:fs");
const path = require("node:path");
const { launchKlive, REPO } = require("./doc-shots/harness.cjs");

const OUT = path.join(REPO, ".local", "z88-annotations-ide-check");
const LABEL = "KlvChkIm1";

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const userHome = path.join(OUT, "home");
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  const failures = [];
  const check = (ok, what) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };

  const klive = await launchKlive({
    home: path.join(OUT, "klive"),
    userHome,
    height: 900,
    sessionSettings: { machineId: "z88", modelId: "OZ47" }
  });
  const { app, ide, cmd, sleep } = klive;
  const output = async () =>
    (await ide.locator('[class*="_commandPanel_"], [class*="_outputWrapper_"]').first().innerText().catch(() => ""))
      .replace(/\s+/g, " ");
  const after = async (text, wait) => {
    const before = (await output()).length;
    await cmd(text, wait);
    return (await output()).slice(Math.max(0, before - 20));
  };

  try {
    // --- A working copy for bank 0 with a label at $0038, written by file as an author does, before the
    // --- machine starts (the ROM pages' layers are loaded with the machine) and with no editor session
    // --- open on it (a session's copy is what the loader reads first)
    const working = path.join(userHome, "Klive", "RomAnnotations", "z88v47.rom.dis");
    fs.mkdirSync(path.dirname(working), { recursive: true });
    fs.writeFileSync(
      working,
      JSON.stringify(
        {
          schemaVersion: 3,
          machine: "rom",
          source: { fileName: "z88v47.rom" },
          pages: { "0": { crc32: "007cedde", name: "OZ 4.7, bank 00h" } },
          banks: {
            "0": {
              offsetIndex: 0,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              localLabels: [{ name: LABEL, value: 0x38 }],
              lineAnnotations: { "56": { synopsis: "IDE check label" } }
            }
          },
          provenance: { "0:56:label": "observed", "0:56:line": "observed", "0:0:region": "observed" }
        },
        null,
        2
      )
    );
    await cmd("em-start", 12000);
    await cmd("em-pause", 2000);

    // --- $0000-$1FFF is RAM bank $20 once OZ has set COM.RAMS (its LOWRAM code), not ROM bank 0: no ROM
    // --- label there, and the export still reassembles
    const live = path.join(OUT, "live-0000.asm");
    const exported = await after(`export-asm "${live}" $0000 $00FF`, 8000);
    const text = fs.existsSync(live) ? fs.readFileSync(live, "utf8") : "";
    check(!text.includes(LABEL), "the RAM at $0000 carries no ROM bank 0 label");
    check(/Verified:/.test(exported), "the export of $0000-$00FF reassembles");

    // --- A bank breakpoint on the Z88
    const bp = await after("bp-set 00:+$0038", 2000);
    check(!/error|not supported|cannot/i.test(bp), `bp-set 00:+$0038 is accepted (${bp.slice(-160)})`);
    await cmd("bp-ea", 800);

    // --- Segment 3 at $C000-$C3FF: while OZ is paused in its kernel, bank 0 (whose first instruction is
    // --- LD SP,$0046). There the working copy's label names $C038, and the export carries OZ calls
    const gn = path.join(OUT, "live-c000.asm");
    const verdict = await after(`export-asm "${gn}" $C000 $C3FF`, 8000);
    check(fs.existsSync(gn) && /Verified:/.test(verdict), `export-asm $C000-$C3FF verifies (${verdict.slice(-200)})`);
    const gnText = fs.existsSync(gn) ? fs.readFileSync(gn, "utf8") : "";
    check(/\.defb .*; oz /i.test(gnText), "an OZ call is exported as its bytes, with the call as the comment");
    const bank0AtC000 = /^\s+ld sp,\$0046/m.test(gnText.split("\n").slice(0, 6).join("\n"));
    if (bank0AtC000) {
      check(
        new RegExp(`^${LABEL}:\\s+ld a,i`, "m").test(gnText),
        "the ROM sidecar's label binds on the running Z88 (bank 0 in segment 3: $C038)"
      );
    } else {
      console.log("skip the label check: bank 0 is not in segment 3 at the pause");
    }

    await ide.screenshot({ path: path.join(OUT, "ide.png") });
  } catch (err) {
    failures.push(String(err));
    console.log(`FAIL ${err}`);
  } finally {
    await app.close();
  }
  if (failures.length > 0) {
    console.log(`\n${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll Z88 annotation IDE checks passed.");
})();
