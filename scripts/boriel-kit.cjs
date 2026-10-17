/*
 * Boriel BASIC setup kits: fetch them into `vendor/boriel-basic/kits/` and stage the one a package
 * build ships (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3.1, `vendor/boriel-basic/README.md`).
 *
 *   node scripts/boriel-kit.cjs fetch [--all | --current | --platform <p> --arch <a>] [--optional]
 *   node scripts/boriel-kit.cjs stage --platform <p> --arch <a>
 *
 * `kit.json` is the only source of truth: a kit is accepted only when its size and SHA-256 match.
 * A file that verifies is never downloaded again; one that does not is replaced. `--optional` turns
 * a failed download into a warning (used by `predev`, so `npm run dev` works offline).
 */
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const VENDOR_FOLDER = path.join(__dirname, "..", "vendor", "boriel-basic");

/** Electron-builder's arch names, as the `package:*` scripts pass them, mapped to Node's. */
const ARCH_ALIASES = { x64: "x64", arm64: "arm64", armv7l: "arm", arm: "arm" };
const PLATFORM_ALIASES = { darwin: "darwin", mac: "darwin", win32: "win32", win: "win32", linux: "linux" };

function readKitManifest(vendorFolder = VENDOR_FOLDER) {
  const manifest = JSON.parse(fs.readFileSync(path.join(vendorFolder, "kit.json"), "utf8"));
  if (!manifest || typeof manifest.kits !== "object" || !manifest.urlBase) {
    throw new Error(`Invalid ${path.join(vendorFolder, "kit.json")}`);
  }
  return manifest;
}

/** The `kit.json` key for a platform and arch (Node or electron-builder names). */
function kitKey(platform, arch) {
  const p = PLATFORM_ALIASES[platform];
  const a = ARCH_ALIASES[arch];
  if (!p || !a) throw new Error(`Unknown platform/arch: ${platform}/${arch}`);
  return `${p}-${a}`;
}

function sha256Of(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Whether `file` is exactly the kit `kit.json` describes. */
function verifyKitFile(file, kit) {
  if (!fs.existsSync(file)) return false;
  if (fs.statSync(file).size !== kit.size) return false;
  return sha256Of(file) === kit.sha256;
}

/** The URLs a kit can come from, in the order they are tried. */
function kitUrls(manifest, kit) {
  return [manifest.urlBase, ...(manifest.mirrors ?? [])].map(
    (base) => `${base.endsWith("/") ? base : `${base}/`}${kit.file}`
  );
}

/**
 * Makes sure `kits/` holds a verified copy of the kit for `key`, downloading it if needed.
 * Returns the file's path; throws when no source yields a matching file.
 */
async function ensureKit(key, options = {}) {
  const vendorFolder = options.vendorFolder ?? VENDOR_FOLDER;
  const manifest = options.manifest ?? readKitManifest(vendorFolder);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const log = options.log ?? (() => {});
  const kit = manifest.kits[key];
  if (!kit) throw new Error(`kit.json has no kit for ${key}`);

  const kitsFolder = path.join(vendorFolder, "kits");
  const target = path.join(kitsFolder, kit.file);
  if (verifyKitFile(target, kit)) return target;

  fs.mkdirSync(kitsFolder, { recursive: true });
  const failures = [];
  for (const url of kitUrls(manifest, kit)) {
    const partial = `${target}.download`;
    try {
      log(`Downloading ${url}`);
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
      if (!verifyKitFile(partial, kit)) throw new Error("size or SHA-256 does not match kit.json");
      fs.renameSync(partial, target);
      return target;
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
      fs.rmSync(partial, { force: true });
    }
  }
  throw new Error(`Cannot get the Boriel BASIC kit ${kit.file}:\n  ${failures.join("\n  ")}`);
}

/** Puts exactly the kit for `key`, plus `kit.json`, into a clean `stage/`. Returns the staged file. */
async function stageKit(key, options = {}) {
  const vendorFolder = options.vendorFolder ?? VENDOR_FOLDER;
  const manifest = options.manifest ?? readKitManifest(vendorFolder);
  const source = await ensureKit(key, { ...options, vendorFolder, manifest });
  const stageFolder = path.join(vendorFolder, "stage");
  fs.rmSync(stageFolder, { recursive: true, force: true });
  fs.mkdirSync(stageFolder, { recursive: true });
  const staged = path.join(stageFolder, path.basename(source));
  fs.copyFileSync(source, staged);
  fs.copyFileSync(path.join(vendorFolder, "kit.json"), path.join(stageFolder, "kit.json"));
  return staged;
}

function parseArgs(argv) {
  const args = { command: argv[0], flags: new Set(), values: {} };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--platform" || arg === "--arch") args.values[arg.slice(2)] = argv[++i];
    else args.flags.add(arg);
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  const log = (line) => console.log(`[boriel-kit] ${line}`);
  const manifest = readKitManifest();
  const keyFromArgs = () =>
    args.flags.has("--current")
      ? kitKey(process.platform, process.arch)
      : kitKey(args.values.platform, args.values.arch);

  if (args.command === "fetch") {
    const keys = args.flags.has("--all") ? Object.keys(manifest.kits) : [keyFromArgs()];
    for (const key of keys) {
      try {
        const file = await ensureKit(key, { manifest, log });
        log(`${key}: ${path.relative(process.cwd(), file)} verified`);
      } catch (error) {
        if (!args.flags.has("--optional")) throw error;
        log(`warning: ${error.message.split("\n")[0]} (continuing without it)`);
      }
    }
    return;
  }
  if (args.command === "stage") {
    const staged = await stageKit(keyFromArgs(), { manifest, log });
    log(`staged ${path.relative(process.cwd(), staged)}`);
    return;
  }
  throw new Error("Usage: boriel-kit.cjs fetch [--all|--current|--platform p --arch a] [--optional] | stage --platform p --arch a");
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[boriel-kit] ${error.message}`);
    process.exit(1);
  });
}

module.exports = { readKitManifest, kitKey, verifyKitFile, kitUrls, ensureKit, stageKit, VENDOR_FOLDER };
