---
type: breaking
---

**BASIC programs build with Boriel BASIC (beta).** Klive BASIC is switched off: every `.zxbas` and `.bas` program now builds with Boriel BASIC 2, which comes with Klive and installs from the first-start offer or **Settings › Integrations**. The choice between the two compilers is gone. Programs that use Klive BASIC's `CODEBANK` or its own header options (`asm-dialect`, `codebank-*`) no longer build as before: move banked code into modules with `'@split-modules`. The editor no longer knows a BASIC program's own names (hover, go to definition, rename). The ZX Spectrum Next BASIC template is a plain program now, and the documentation describes Boriel BASIC only.
