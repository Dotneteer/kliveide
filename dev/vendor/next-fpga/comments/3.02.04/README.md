# Klive's comments on the ZX Spectrum Next VHDL 3.02.04

Base: upstream `gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA`, commit
`dc8d76419a6968d6c93bfa5f62231a40ad8b4221` (tip of branch `30204`, 2026-05-28), path
`cores/zxnext/` (the pin in `../../sources.json`). Regenerate with
`npm run next-fpga:comments -- --save 3.02.04`; never edit a `.patch` by hand.

These patches were carried from `../3.02.01/` with `npm run next-fpga:comments -- --carry 3.02.01
3.02.04`; every hunk applied (some at an offset, none with fuzz). What each one explains is in
`../3.02.01/README.md`.

| Patch | Carried from | Note |
|---|---|---|
| `src/cpu/t80n/t80na.vhd.patch` | `src/cpu/t80na.vhd` | Upstream moved the T80N into `src/cpu/t80n/` (and added the `-complete`, `-debug` and `-complete-debug` variants beside it); the file itself is unchanged. The issue 4 build instantiates `T80na_Debug` (`g_option(1:0) = "10"`), which these comments do not cover. |
| `src/cpu/t80n/t80n.vhd.patch` | `src/cpu/t80n.vhd` | Applied 14 lines lower: 3.02.04 changed `EX (SP),HL` above it. |
| `src/device/divmmc.vhd.patch` | same path | The file is unchanged upstream. |
| `nextreg.txt.patch` | same path | The two stray edits of the 3.02.01 patch; they carry no meaning and can be dropped. |
