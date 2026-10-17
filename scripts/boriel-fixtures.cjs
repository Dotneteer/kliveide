/*
 * Regenerates the Boriel BASIC test fixtures (`test/boriel/fixtures/`, plan decision B-T1): each
 * folder's `program.bas`, compiled by an installed zxbc with the arguments in its `fixture.json`,
 * into `program.bin`, `program.dbg` and `program.map` (and `program.nex` when `fixture.json` says `"nex": true`).
 * `"banked": true` builds with `--split-modules` into `program.z80` (128K) or `program.nex` (Next)
 * instead of `program.bin`; `"from"` names another fixture folder whose sources it builds. Run
 * locally only - CI uses the committed files.
 *
 *   npm run boriel:fixtures [-- <path to zxbc>]
 *
 * The zxbc comes from the argument, else `BORIEL_ZXBC`, else `~/zxbasic2/zxbc`. It must be the
 * version `vendor/boriel-basic/kit.json` pins. zxbc runs inside each fixture folder with a relative
 * program name, so no absolute path of this machine ends up in the committed `.dbg`.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const FIXTURES = path.join(__dirname, "..", "test", "boriel", "fixtures");
const KIT = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vendor", "boriel-basic", "kit.json"), "utf8"));

function zxbcPath() {
  const exe = process.platform === "win32" ? "zxbc.exe" : "zxbc";
  return process.argv[2] || process.env.BORIEL_ZXBC || path.join(os.homedir(), "zxbasic2", exe);
}

function main() {
  const zxbc = zxbcPath();
  if (!fs.existsSync(zxbc)) throw new Error(`No zxbc at ${zxbc}. Install Boriel BASIC from Klive, or pass its path.`);
  const version = execFileSync(zxbc, ["--version"], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (!version.includes(KIT.version)) throw new Error(`${zxbc} is "${version}"; the fixtures need ${KIT.version}.`);
  for (const name of fs.readdirSync(FIXTURES).sort()) {
    const folder = path.join(FIXTURES, name);
    const spec = path.join(folder, "fixture.json");
    if (!fs.existsSync(spec)) continue;
    const { args, nex, banked, from = "." } = JSON.parse(fs.readFileSync(spec, "utf8"));
    for (const f of ["program.bin", "program.dbg", "program.map", "program.err", "program.nex", "program.z80"]) {
      fs.rmSync(path.join(folder, f), { force: true });
    }
    // --- A banked build (--split-modules) cannot write bin: a 128K snapshot, or the Next's .nex,
    // --- holds the program instead. "from" names the folder with the sources, shared by fixtures.
    const format = !banked ? "bin" : args.includes("zxnext") ? "nex" : "z80";
    const output = `program.${format}`;
    try {
      execFileSync(
        zxbc,
        [
          path.join(from, "program.bas"),
          ...args,
          "-m",
          from,
          "-f",
          format,
          ...(format === "z80" ? ["-B", "-a"] : []),
          "-o",
          output,
          "--debug=program.dbg",
          "-M",
          "program.map",
          "-e",
          "program.err"
        ],
        { cwd: folder, timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] }
      );
    } catch (error) {
      const err = path.join(folder, "program.err");
      throw new Error(`${name}: zxbc failed\n${fs.existsSync(err) ? fs.readFileSync(err, "utf8") : error.message}`);
    }
    // --- "nex": true also writes the .nex a Next program starts from. With --debug, as the .bin:
    // --- the flag changes zxbc's code, and the .nex must hold the program the .dbg describes
    if (nex) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "boriel-fixture-"));
      try {
        execFileSync(zxbc, ["program.bas", ...args, "-f", "nex", "-o", "program.nex", `--debug=${path.join(tmp, "nex.dbg")}`], {
          cwd: folder,
          timeout: 60_000,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
    const err = path.join(folder, "program.err");
    const warnings = fs.existsSync(err) ? fs.readFileSync(err, "utf8").trim() : "";
    if (!warnings) fs.rmSync(err, { force: true });
    console.log(`[boriel-fixtures] ${name}: ${output}, ${fs.statSync(path.join(folder, output)).size} bytes${warnings ? " (with warnings)" : ""}`);
  }
}

main();
