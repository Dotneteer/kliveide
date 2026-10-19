// Applies a JSON batch of labels, line annotations and regions to a ROM sidecar, through Klive's
// own formatRomSidecar, so the file stays canonical. Offsets may be "$XXXX" (hex) or decimal.
// Usage: node .ai/rom-annotations/tools/apply-annotations.cjs <sidecar.dis> <batch.json> <code-listing>
//   <code-listing>: zx81-dis.cjs / zx80-dis.cjs output of the SAME regions with .def lines removed; every label and
//   line key must be an instruction start in it (or inside a data region), labels at most 16 chars.
// Batch: {"regions":[{start,end,type,decode?,rowBytes?,radix?,synopsis?,provenance?}], "labels":{"$0419":"MAIN_LOOP"},
//         "dataLabels":{"$0562":"EDIT_KEY_TABLE"} (table starts inside data regions),
//         "manualLines":["$0476"], "lines":{"$0419":{"synopsis":"...","comment":"..."}}}
// Existing labels win (a clash is reported, not overwritten); lines are merged into existing entries.
// New regions are carved out of disassemble regions. Provenance: observed, or manual for manualLines.
const { existsSync, readFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const root = resolve(__dirname, "../../..");
process.chdir(root);
module.paths.unshift(join(root, "node_modules"));
function registerTsRuntime() {
  const esbuild = require(join(root,"node_modules/esbuild"));
  require.extensions[".ts"] = (module, filename) => {
    const result = esbuild.transformSync(readFileSync(filename, "utf8"), {
      format: "cjs",
      loader: "ts",
      platform: "node",
      target: "es2020",
      tsconfigRaw: { compilerOptions: { esModuleInterop: true, useDefineForClassFields: false } }
    });
    module._compile(result.code, filename);
  };
  require(join(root,"node_modules/tsconfig-paths")).register({
    baseUrl: root,
    paths: {
      "@abstractions/*": ["src/common/abstractions/*"],
      "@common/*": ["src/common/*"],
      "@messaging/*": ["src/common/messaging/*"],
      "@state/*": ["src/common/state/*"],
      "@utils/*": ["src/common/utils/*"],
      "@renderer/*": ["src/renderer/*"],
      "@emu/*": ["src/emu/*"],
      "@appIde/*": ["src/renderer/appIde/*"],
      "@main/*": ["src/main/*"],
      "@controls/*": ["src/renderer/controls/*"]
    }
  });
  const Module = require("node:module");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, opts) {
    try {
      return original.call(this, request, parent, isMain, opts);
    } catch (error) {
      if (error?.code === "MODULE_NOT_FOUND" && parent?.filename) {
        const base = request.startsWith(".") ? resolve(dirname(parent.filename), request) : undefined;
        for (const candidate of base ? [`${base}.ts`, `${base}/index.ts`] : []) {
          if (existsSync(candidate)) return candidate;
        }
      }
      throw error;
    }
  };
}

registerTsRuntime();
const tools = require(join(root, "src/common/roms/romAnnotationTools.ts"));
const { writeFileSync } = require("node:fs");
const [file, dataFile, listFile] = process.argv.slice(2);
const n = (k) => (String(k).startsWith("$") ? parseInt(String(k).slice(1), 16) : Number(k));
const sidecar = JSON.parse(readFileSync(file, "utf8"));
const data = JSON.parse(readFileSync(dataFile, "utf8"));
const bank = sidecar.banks["0"];
bank.localLabels ??= []; bank.lineAnnotations ??= {}; sidecar.provenance ??= {};
// The page ends where the file's last region ends (16383 for the ZX81's 16K page, 4095 for the ZX80's 4K one)
const pageEnd = Math.max(...bank.regions.map((r) => r.end));
const starts = new Set(readFileSync(listFile, "utf8").split("\n").filter(Boolean).map((l) => parseInt(l.slice(0, 4), 16)));
const manual = new Set((data.manualLines ?? []).map(n));
// --- regions: carve the new data regions out of the disassemble regions
const added = (data.regions ?? []).map((r) => ({ start: n(r.start), end: n(r.end), type: r.type, ...(r.decode ? { decode: r.decode } : {}), ...(r.rowBytes ? { rowBytes: r.rowBytes } : {}), ...(r.radix ? { radix: r.radix } : {}) }));
const dataRegions = [...bank.regions.filter((r) => r.type !== "disassemble"), ...added].sort((a, b) => a.start - b.start);
const regions = [];
let at = 0;
for (const r of dataRegions) {
  if (r.start > at) regions.push({ start: at, end: r.start - 1, type: "disassemble" });
  regions.push(r);
  at = r.end + 1;
}
if (at <= pageEnd) regions.push({ start: at, end: pageEnd, type: "disassemble" });
bank.regions = regions;
const inData = (o) => dataRegions.some((r) => o >= r.start && o <= r.end);
for (const r of data.regions ?? []) {
  const s = n(r.start);
  sidecar.provenance[`0:${s}:region`] = r.provenance ?? "observed";
  if (r.synopsis) {
    bank.lineAnnotations[String(s)] = { ...(bank.lineAnnotations[String(s)] ?? {}), synopsis: r.synopsis };
    sidecar.provenance[`0:${s}:line`] = r.provenance ?? "observed";
  }
}
// --- the listing a region change invalidates: an existing label inside data is an error
for (const l of bank.localLabels ?? []) if (inData(l.value)) console.log("LABEL IN DATA:", l.name);
const problems = [];
for (const [k, name] of Object.entries(data.labels)) {
  const value = n(k);
  if (!starts.has(value) || inData(value)) problems.push(`label ${name} not on code`);
  if (name.length > 16) problems.push(`label ${name} too long`);
  const clash = bank.localLabels.find((l) => l.value === value || l.name === name);
  if (clash) { console.log("label kept:", clash.name, "for", name); continue; }
  bank.localLabels.push({ name, value });
  sidecar.provenance[`0:${value}:label`] = "observed";
}
// dataLabels: labels on table starts, which must lie inside a data region (the IDE shows them there)
for (const [k, name] of Object.entries(data.dataLabels ?? {})) {
  const value = n(k);
  if (!inData(value)) problems.push(`data label ${name} not inside a data region`);
  if (name.length > 16) problems.push(`label ${name} too long`);
  const clash = bank.localLabels.find((l) => l.value === value || l.name === name);
  if (clash) { console.log("label kept:", clash.name, "for", name); continue; }
  bank.localLabels.push({ name, value });
  sidecar.provenance[`0:${value}:label`] = "observed";
}
bank.localLabels.sort((a, b) => a.value - b.value);
for (const [k, entry] of Object.entries(data.lines)) {
  const o = n(k);
  if (!starts.has(o) && !inData(o)) problems.push(`line ${k} not an instruction start`);
  bank.lineAnnotations[String(o)] = { ...(bank.lineAnnotations[String(o)] ?? {}), ...entry };
  sidecar.provenance[`0:${o}:line`] = manual.has(o) ? "manual" : "observed";
}
if (problems.length) { console.log("PROBLEMS:\n" + problems.join("\n")); process.exit(1); }
console.log("missing provenance:", tools.missingProvenance(sidecar));
writeFileSync(file, tools.formatRomSidecar(sidecar));
console.log("labels:", bank.localLabels.length, "regions:", bank.regions.length);
