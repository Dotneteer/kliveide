// Builds mockup.html from mockup.template.html, inlining the code it shares with the Memory view
// mockup (dev/plans/memory-disassembly-views/shared/), the real ROM pages with everything their sidecars say (labels,
// data regions, comments, synopses), the ZX Spectrum's system variable names and the NextReg names:
//   node dev/plans/memory-disassembly-views/disassembly/build-mockup.cjs
const path = require("path");
const { romData, sysVars, nextRegNames, shared, inline } = require("../shared/build-lib.cjs");

inline(path.join(__dirname, "mockup.template.html"), path.join(__dirname, "mockup.html"), {
  "/*__SHARED_CSS__*/": shared("view.css"),
  __ROMS__: JSON.stringify(romData(true)),
  __SYSVARS__: JSON.stringify(sysVars()),
  __NEXTREGS__: JSON.stringify(nextRegNames()),
  "/*__SHARED_MACHINES__*/": shared("machines.js"),
  "/*__SHARED_Z80__*/": shared("z80.js")
});
