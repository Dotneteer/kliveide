# Klive's comments on the ZX Spectrum Next VHDL 3.02.01

Base: upstream `gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA`, commit
`5ad7546d19d7e1b60645c11086c8407f238280df` (2023-09-06), path `cores/zxnext/` (the pin in
`../../sources.json`). Every patch is a unified diff against that commit's file at the same path,
applied by `npm run next-fpga:fetch` after the blob-id check. Regenerate them with
`npm run next-fpga:comments -- --save 3.02.01` after editing `vendor/next-fpga/3.02.01/`; never edit
a `.patch` by hand. The plan is `.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D4.1.

These patches are what `_input/next-fpga/` carried beyond upstream; applying them to the pinned tree
reproduces that folder byte for byte, except `src/misc/relaxation.vhd`, whose only difference was
CRLF vs LF line endings and which therefore has no patch.

| Patch | What it adds |
|---|---|
| `src/cpu/t80na.vhd.patch` | Explanatory comments on the `T80Na` entity's ports (one paragraph per Z80 pin: what it means and its polarity) and on the internal signals `CEN`, `Reset_s`, `IntCycle_n`, `IORQ`, `TState`; the `Mode` generic's comment reduced to "Standard Z80 CPU". No logic change. |
| `src/cpu/t80n.vhd.patch` | Removes six commented-out lines (Fabio Belavenuto's old IRQ-acknowledge `M1_n` timing, superseded by the 30/10/19 fix just above them) near the end of the `M1_n` process. No logic change. |
| `src/device/divmmc.vhd.patch` | Comments on each port of the `divmmc` entity: which NextReg bit or signal drives it (`i_en` = NextReg $84 bit 7, `i_automap_reset`, the instant/delayed automap entry points, the ROM/RAM enable outputs, the RAM bank). No logic change. |
| `nextreg.txt.patch` | Two stray edits, kept only so the old folder is reproduced exactly: a line holding two spaces after NextReg $6B bit 3, and `applied0` for `applied` in NextReg $8F bits 1:0. Neither is a comment worth keeping; drop this patch (and its 3.02.04 carry) once nothing compares against `_input/next-fpga/`. |
