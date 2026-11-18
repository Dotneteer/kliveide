// Builds mockup.html from mockup.template.html, inlining the code it shares with the Disassembly
// view mockup (dev/plans/memory-disassembly-views/shared/) and the real ROM pages with their sidecar labels, so the
// mockup opens straight from the file system:
//   node dev/plans/memory-disassembly-views/memory/build-mockup.cjs
const path = require("path");
const { romData, shared, inline } = require("../shared/build-lib.cjs");

inline(path.join(__dirname, "mockup.template.html"), path.join(__dirname, "mockup.html"), {
  __ROMS__: JSON.stringify(romData(false)),
  "/*__SHARED_CSS__*/": shared("view.css"),
  "/*__SHARED_MACHINES__*/": shared("machines.js"),
  "/*__SHARED_Z80__*/": shared("z80.js")
});
