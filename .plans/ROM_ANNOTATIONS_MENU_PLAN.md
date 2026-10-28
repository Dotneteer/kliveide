# ROM Annotations Menu — Plan

Status: **implemented** (2026-10-28).

## Goal

Open a ROM's annotations from the menu, picking the machine type and then the ROM, instead of typing
`rom-ann-open <rom> [-page <n>]` at the IDE's command prompt.

## Decisions

- **D1 — Where.** `Debug › ROM Annotations`, after *Export Disassembly as Source*: a submenu per
  machine type, each holding that machine's ROMs. Shown for every machine (no machine needs to run to
  edit a ROM's annotations) and not gated by the advanced-debugging switch, like the commands.
- **D2 — Which ROMs.** The ROM pages Klive ships and knows: every page of `KNOWN_ROM_PAGES`
  (`src/common/roms/romIdentity.ts`) and every page that has a shipped sidecar
  (`src/public/roms/rom-annotations.index.json`, e.g. the HT-1080Z's character generators). One
  table, `src/common/roms/romAnnotationCatalog.ts`, lists them by machine type and groups them by ROM
  set (separators in the menu). A test keeps it in step with both sources and the shipped files.
  Machines whose ROMs Klive does not ship or know (Z88, Timex, Scorpion, C64) have no submenu.
- **D3 — Labels.** The machine type's registry name (verbatim, as in *Machine type*); the ROM's file
  name, with its 16K page for a multi-page file (`enNextZX.rom, page 2`, one translatable text).
- **D4 — What a click does.** It shows the IDE window and runs
  `rom-ann-open <file> [-page <n>] -create`: the working copy when there is one, else the shipped
  annotations (read-only, as the command does today). The new `-create` option covers a ROM with
  neither: it starts an empty working copy, as `rom-ann-new` would, rather than failing — so every
  item in the menu opens something. A failure is shown in a message box, like other menu commands.

## Steps

1. The catalog and its consistency test.
2. `rom-ann-open -create`, with a test.
3. The menu builder (`src/main/menus/rom-annotations-menu.ts`), wired into the Debug menu; English
   texts with translator context; menu tests.
4. Docs: the annotations guide and the `rom-ann-open` reference mention the menu and `-create`.
