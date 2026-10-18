---
type: feature
issues: [1463]
highlight: "**Boriel BASIC 2 comes with Klive,** with source-level debugging on the ZX Spectrum and the Next."
---
**Boriel BASIC 2 comes with Klive:** Klive includes Boriel's `zxbc` 2.0.0-beta25 and offers to
install it the first time it starts (in `~/zxbasic2` by default); skip it and install it later
from **Settings › Integrations › Boriel BASIC**, which also accepts, repairs or updates an
existing installation. Klive BASIC stays the default. To switch, choose **Boriel BASIC** in
**Settings › Integrations › Compiler for BASIC programs**, tick **Use Boriel BASIC to build BASIC
programs** in the Boriel BASIC dialog, or type `set zxbasic.compiler boriel`. The status bar names
the compiler of the focused BASIC file, and a click opens the dialog. The build options in the
source header become `zxbc` options, and the few that only Klive BASIC knows give a warning.
Boriel BASIC builds for the 48K, 128K, +3, Timex, Scorpion and Next; the result can be run,
injected and exported, and `zxbc`'s errors keep their codes.
