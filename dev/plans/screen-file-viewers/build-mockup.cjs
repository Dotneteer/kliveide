// Builds mockup.html from mockup.template.html, inlining the 48K ROM's character set (the sample
// pictures' text is drawn with it), so the mockup opens straight from the file system:
//   node dev/plans/screen-file-viewers/build-mockup.cjs
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..", "..");
const rom = fs.readFileSync(path.join(REPO, "src", "public", "roms", "sp48.rom"));
// --- The character set: 96 characters of 8 bytes from $3D00
const font = rom.subarray(0x3d00, 0x3d00 + 96 * 8).toString("base64");

const template = fs.readFileSync(path.join(__dirname, "mockup.template.html"), "utf8");
// --- the sample files: one source with generate-samples.cjs
const samples = fs.readFileSync(path.join(__dirname, "samples.js"), "utf8");
for (const p of ["__ROM_FONT__", "/*__SAMPLES__*/"]) if (!template.includes(p)) throw new Error(`placeholder ${p} not found`);
const out = template.replace("__ROM_FONT__", font).replace("/*__SAMPLES__*/", () => samples);
fs.writeFileSync(path.join(__dirname, "mockup.html"), out);
console.log("wrote", path.join(__dirname, "mockup.html"));
