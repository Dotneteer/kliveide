/*
 * Regenerates the z88dk test fixtures (`test/z88dk/fixtures/`, `.plans/Z88DK_INTEGRATION_PLAN.md`
 * §0.1, as Boriel's B-T1): each folder's sources, compiled by an installed z88dk with the arguments
 * in its `fixture.json`, into `program` (the raw image), `program.map` (`program.map.gz` with
 * `"map": "gzip"`, none with `"map": false`) and whatever `-create-app` writes (`program.tap`,
 * `program.nex`, `program.P`, `program.epr`, `program_BANK_n.bin`). Run locally only - CI uses the
 * committed files, and never runs zcc.
 *
 * A **template fixture** (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md`, T1) names a shipped project
 * template (`"template": "<machineId>"`): its `main.c` is copied from
 * `src/public/project-templates/<machineId>/z88-dk/code/main.c` first, and `"zccArgs"` is the complete
 * argument list Klive's debug build passes (`zccArgumentsFor`), used verbatim; `test/z88dk/templates.test.ts`
 * checks both against the product.
 *
 *   npm run z88dk:fixtures [-- <z88dk root>]
 *
 * The root comes from the argument, else `Z88DK_ROOT`, else `~/z88dk`. It must be a supported
 * release (v2.4, build 23854, or newer; `.ai/z88dk/README.md`).
 *
 * zcc runs inside each fixture folder with relative source names, so the project's own records name
 * `main.c`, not this machine's path. The map is otherwise zcc's output with two normalisations, and
 * nothing else is changed: the install root (plain, and hex-escaped in symbol names) becomes
 * `/opt/z88dk`, and zcc's temp names (`/tmp/tmpXXXXXXXX.i`, `/tmp/tmpzccXXXXXXXX/zcc_opt.def`, new every
 * build) become `/tmp/tmpklive...` - so a regenerated fixture differs only where the compiler's output did.
 */
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const FIXTURES = path.join(__dirname, "..", "test", "z88dk", "fixtures");
const TEMPLATES = path.join(__dirname, "..", "src", "public", "project-templates");
const MIN_BUILD = 23854;
const NEUTRAL_ROOT = "/opt/z88dk";
const OUTPUTS = /^program(\.(map|map\.gz|tap|nex|P|O|epr|dsk|63|62|ap0)|_[A-Za-z0-9_]+\.bin)?$/;

function z88dkRoot() {
  return process.argv[2] || process.env.Z88DK_ROOT || path.join(os.homedir(), "z88dk");
}

/**
 * The map's escapings of a name (`.ai/z88dk/map-format.md`): line records write every character but
 * [A-Za-z0-9] as `_xx`; `__CDBINFO__` records escape digits too.
 */
function escapeName(text, digitsToo = false) {
  const pattern = digitsToo ? /[^A-Za-z]/g : /[^A-Za-z0-9]/g;
  return text.replace(pattern, (c) => `_${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

function zccEnv(root) {
  return {
    ...process.env,
    ZCCCFG: path.join(root, "lib", "config"),
    PATH: `${path.join(root, "bin")}${path.delimiter}${process.env.PATH ?? ""}`
  };
}

function zccBuild(root) {
  // --- zcc without arguments prints its banner (and usage) on stderr and exits 0
  const run = spawnSync(path.join(root, "bin", process.platform === "win32" ? "zcc.exe" : "zcc"), [], {
    encoding: "utf8",
    env: zccEnv(root),
    timeout: 15_000
  });
  const match = /\bv(\d+)-[0-9a-f]+-\d{8}\b/.exec(`${run.stderr ?? ""}${run.stdout ?? ""}`);
  return match ? Number(match[1]) : undefined;
}

function normaliseMap(text, root) {
  const plainRoot = root.replaceAll("\\", "/").replace(/\/$/, "");
  return text
    .split(plainRoot)
    .join(NEUTRAL_ROOT)
    .split(escapeName(plainRoot))
    .join(escapeName(NEUTRAL_ROOT))
    .split(escapeName(plainRoot, true))
    .join(escapeName(NEUTRAL_ROOT, true))
    .replace(/\/tmp\/tmp[A-Za-z0-9]+/g, "/tmp/tmpklive")
    .replace(/_2ftmp_2ftmp[A-Za-z0-9]+/g, escapeName("/tmp/tmpklive"));
}

function main() {
  const root = path.resolve(z88dkRoot());
  if (!fs.existsSync(path.join(root, "lib", "config"))) {
    throw new Error(`No z88dk at ${root}. Install it from Klive (Integrations | z88dk), or pass its folder.`);
  }
  const build = zccBuild(root);
  if (!build || build < MIN_BUILD) {
    throw new Error(`${root} is z88dk build ${build ?? "?"}; the fixtures need build ${MIN_BUILD} (v2.4) or newer.`);
  }
  for (const name of fs.readdirSync(FIXTURES).sort()) {
    const folder = path.join(FIXTURES, name);
    const spec = path.join(folder, "fixture.json");
    if (!fs.existsSync(spec)) continue;
    const { args, sources, zccArgs, template, map = true } = JSON.parse(fs.readFileSync(spec, "utf8"));
    for (const file of fs.readdirSync(folder)) {
      if (OUTPUTS.test(file)) fs.rmSync(path.join(folder, file), { force: true });
    }
    // --- A template fixture compiles the shipped template's program, never a copy edited here
    if (template) {
      fs.copyFileSync(path.join(TEMPLATES, template, "z88-dk", "code", "main.c"), path.join(folder, "main.c"));
    }
    try {
      execFileSync(
        path.join(root, "bin", process.platform === "win32" ? "zcc.exe" : "zcc"),
        zccArgs ?? [...args, "-debug", "-m", "-create-app", "-o", "program", ...sources],
        { cwd: folder, env: zccEnv(root), stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }
      );
    } catch (error) {
      throw new Error(`${name}: zcc failed:\n${error.stdout ?? ""}${error.stderr ?? ""}`);
    }
    const mapFile = path.join(folder, "program.map");
    // --- `"map": false`: a map too big to commit (the Next's classic library makes 1.2 MB of it)
    // --- `"map": "gzip"`: committed compressed (the template fixtures; the Next's is 1.2 MB plain)
    if (map === "gzip") {
      const text = normaliseMap(fs.readFileSync(mapFile, "utf8"), root);
      fs.writeFileSync(`${mapFile}.gz`, zlib.gzipSync(Buffer.from(text, "utf8"), { level: 9 }));
      fs.rmSync(mapFile);
    } else if (map) fs.writeFileSync(mapFile, normaliseMap(fs.readFileSync(mapFile, "utf8"), root));
    else fs.rmSync(mapFile);
    // --- Intermediate files appmake leaves beside the outputs Klive reads
    for (const file of fs.readdirSync(folder)) {
      if (/^program_(BSS|DATA|bss_fardata|CODE)\.bin$/.test(file)) fs.rmSync(path.join(folder, file));
    }
    const written = fs.readdirSync(folder).filter((f) => OUTPUTS.test(f));
    console.log(`${name}: ${written.join(", ")}`);
  }
}

main();
